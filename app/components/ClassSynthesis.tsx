import React, { useMemo, useState } from 'react';
import { Student, SchoolProgram, Section, Proficiency, Domain, SupportGroup } from '../types';
import { sectionNames, computeSupportGroup } from '../utils';
import Tooltip from './Tooltip';
import useModalDismiss from '../hooks/useModalDismiss';

function collectAllSkillIds(domains: Domain[]): string[] {
  const ids: string[] = [];
  const recurse = (ds: Domain[]) => {
    ds.forEach(d => {
      d.skills.forEach(s => ids.push(s.id));
      recurse(d.subDomains || []);
    });
  };
  recurse(domains);
  return ids;
}

const sectionOrder: Section[] = [Section.TPS, Section.PS, Section.MS, Section.GS];

interface FilterScope {
  id: string;
  label: string;
  type: 'domain' | 'subdomain' | 'skill';
  skillIds: string[];
}

interface ClassSynthesisProps {
  students: Student[];
  schoolPrograms: SchoolProgram[];
  supportGroups: SupportGroup[];
  onUpdateSupportGroups: (groups: SupportGroup[]) => void;
  /** Impression des photos de preuve (toute la classe cochée par défaut). */
  onPrintProofs?: () => void;
  /** Téléphone : retour à la liste des élèves. */
  onBack?: () => void;
}

const chipClass = (type: FilterScope['type']) =>
  type === 'domain'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    : type === 'subdomain'
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';

function emptyGroup(type: 'suggested' | 'free'): SupportGroup {
  return { id: crypto.randomUUID(), type, name: '', maxStudents: 5, filterIds: [], studentIds: [] };
}

const ClassSynthesis: React.FC<ClassSynthesisProps> = ({ students, schoolPrograms, supportGroups, onUpdateSupportGroups, onPrintProofs, onBack }) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | Section>('all');
  const [modal, setModal] = useState<{ group: SupportGroup; isNew: boolean } | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);

  const availableSections = useMemo(
    () => sectionOrder.filter(s => students.some(st => st.section === s)),
    [students]
  );

  const filteredStudents = useMemo(
    () => selectedFilter === 'all' ? students : students.filter(s => s.section === selectedFilter),
    [students, selectedFilter]
  );

  const allSkillIds = useMemo(() => {
    const ids: string[] = [];
    schoolPrograms.forEach(p => ids.push(...collectAllSkillIds(p.domains)));
    return ids;
  }, [schoolPrograms]);

  const avgStats = useMemo(() => {
    if (filteredStudents.length === 0 || allSkillIds.length === 0) return null;
    const counts = filteredStudents.map(s =>
      allSkillIds.filter(id => s.skills[id]?.proficiency === Proficiency.Acquired).length
    );
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    return {
      avg: Math.round(avg * 10) / 10,
      max: Math.max(...counts),
      min: Math.min(...counts),
      total: allSkillIds.length,
      percent: Math.round(avg / allSkillIds.length * 100),
    };
  }, [filteredStudents, allSkillIds]);

  const domainStats = useMemo(() => {
    return schoolPrograms
      .map(program => {
        const domains = program.domains
          .map(domain => {
            const skillIds = collectAllSkillIds([domain]);
            if (skillIds.length === 0) return null;
            const counts = filteredStudents.map(s =>
              skillIds.filter(id => s.skills[id]?.proficiency === Proficiency.Acquired).length
            );
            const avg = filteredStudents.length > 0
              ? counts.reduce((a, b) => a + b, 0) / filteredStudents.length
              : 0;
            return {
              id: domain.id,
              name: domain.name,
              avg: Math.round(avg * 10) / 10,
              total: skillIds.length,
              percent: Math.round(avg / skillIds.length * 100),
            };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null);
        return { programId: program.id, programName: program.name, domains };
      })
      .filter(p => p.domains.length > 0);
  }, [schoolPrograms, filteredStudents]);

  const skillRankings = useMemo(() => {
    type SkillEntry = { id: string; name: string; domainName: string; acquiredCount: number };
    const list: SkillEntry[] = [];

    const collect = (domains: Domain[], parentDomainName?: string) => {
      domains.forEach(domain => {
        const domainName = parentDomainName ?? domain.name;
        domain.skills.forEach(skill => {
          // Acquisitions creuses : seules les compétences acquises par au moins un élève comptent.
          const acquiredCount = filteredStudents.filter(
            s => s.skills[skill.id]?.proficiency === Proficiency.Acquired
          ).length;
          if (acquiredCount === 0) return;
          list.push({ id: skill.id, name: skill.name, domainName, acquiredCount });
        });
        collect(domain.subDomains || [], domain.name);
      });
    };

    schoolPrograms.forEach(p => collect(p.domains));

    return {
      top10: [...list].sort((a, b) => b.acquiredCount - a.acquiredCount).slice(0, 10),
    };
  }, [schoolPrograms, filteredStudents]);

  const allFilterScopes = useMemo((): FilterScope[] => {
    const scopes: FilterScope[] = [];
    const processLevel = (domain: Domain, isTop: boolean) => {
      const skillIds = collectAllSkillIds([domain]);
      if (skillIds.length > 0) {
        scopes.push({ id: `d:${domain.id}`, label: domain.name, type: isTop ? 'domain' : 'subdomain', skillIds });
      }
      (domain.subDomains || []).forEach(sub => processLevel(sub, false));
      domain.skills.forEach(skill => {
        scopes.push({ id: `sk:${skill.id}`, label: skill.name, type: 'skill', skillIds: [skill.id] });
      });
    };
    schoolPrograms.forEach(p => p.domains.forEach(d => processLevel(d, true)));
    return scopes;
  }, [schoolPrograms]);

  // Même calcul que la validation en masse (utils.computeSupportGroup), sur toute la classe.
  const getSuggestedGroup = (group: SupportGroup) => computeSupportGroup(group, students, schoolPrograms);

  const resetDropdowns = () => {
    setFilterDropdownOpen(false);
    setFilterSearch('');
    setStudentDropdownOpen(false);
    setStudentSearch('');
  };

  const openCreate = (type: 'suggested' | 'free') => {
    setModal({ group: emptyGroup(type), isNew: true });
    resetDropdowns();
  };

  const openEdit = (group: SupportGroup) => {
    setModal({ group: { ...group }, isNew: false });
    resetDropdowns();
  };

  const closeModal = () => {
    setModal(null);
    resetDropdowns();
  };

  const saveModal = () => {
    if (!modal) return;
    if (modal.isNew) {
      onUpdateSupportGroups([...supportGroups, modal.group]);
    } else {
      onUpdateSupportGroups(supportGroups.map(g => g.id === modal.group.id ? modal.group : g));
    }
    closeModal();
  };

  const deleteGroup = (id: string) => {
    onUpdateSupportGroups(supportGroups.filter(g => g.id !== id));
    closeModal();
  };

  const updateModal = (updates: Partial<SupportGroup>) =>
    setModal(prev => prev ? { ...prev, group: { ...prev.group, ...updates } } : null);

  // Modale « sale » : des modifications du groupe seraient perdues en cas de fermeture accidentelle.
  const modalIsDirty = useMemo(() => {
    if (!modal) return false;
    if (modal.isNew) {
      const g = modal.group;
      return !!(
        g.name.trim() ||
        g.filterIds.length ||
        g.studentIds.length ||
        (g.addedStudentIds?.length ?? 0) ||
        (g.excludedStudentIds?.length ?? 0) ||
        g.maxStudents !== 5
      );
    }
    const original = supportGroups.find(g => g.id === modal.group.id);
    return !original || JSON.stringify(original) !== JSON.stringify(modal.group);
  }, [modal, supportGroups]);

  const handleModalBackdropClick = useModalDismiss(closeModal, modal !== null, !modalIsDirty);

  if (students.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center p-8">
        <div className="text-slate-500 dark:text-zinc-400">
          <h1 className="text-2xl font-bold mb-2 text-slate-700 dark:text-zinc-300">Bienvenue !</h1>
          <p>La classe ne contient encore aucun élève.</p>
          <p>Ajoutez un élève (bouton « + » de la liste) ou importez-en pour commencer.</p>
        </div>
      </div>
    );
  }

  const renderSkillRow = (skill: { id: string; name: string; acquiredCount: number }, index: number, color: string) => {
    const pct = filteredStudents.length > 0
      ? Math.round(skill.acquiredCount / filteredStudents.length * 100)
      : 0;
    return (
      <li key={skill.id} className="flex items-start gap-2">
        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 w-5 shrink-0 pt-0.5 tabular-nums text-right">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <Tooltip content={skill.name} position="bottom" wrapperClassName="min-w-0">
              <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 truncate">
                {skill.name}
              </span>
            </Tooltip>
            <span className="text-xs tabular-nums text-slate-500 dark:text-zinc-400 shrink-0">
              {skill.acquiredCount}/{filteredStudents.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 dark:bg-zinc-700 rounded-full h-1.5">
              <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400 dark:text-zinc-500 w-8 text-right shrink-0 tabular-nums">
              {pct}%
            </span>
          </div>
        </div>
      </li>
    );
  };

  const suggestedGroups = supportGroups.filter(g => g.type === 'suggested');
  const freeGroups = supportGroups.filter(g => g.type === 'free');

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {onBack && (
                <button onClick={onBack} aria-label="Retour à la liste des élèves" className="sm:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-200 dark:text-zinc-400 dark:hover:bg-zinc-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
                </button>
              )}
              <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-200">Synthèse de la classe</h1>
            </div>
            {onPrintProofs && (
              <button onClick={onPrintProofs} className="px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0118 8.653v4.097A2.25 2.25 0 0115.75 15h-.241l.305 1.984A1.75 1.75 0 0114.084 19H5.915a1.75 1.75 0 01-1.73-2.016L4.492 15H4.25A2.25 2.25 0 012 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.75-.107 1.127-.153L5 6.25v-3.5zm8.5 3.397a41.533 41.533 0 00-7 0V2.75a.25.25 0 01.25-.25h6.5a.25.25 0 01.25.25v3.397zM6.608 12.5a.25.25 0 00-.247.212l-.693 4.5a.25.25 0 00.247.288h8.17a.25.25 0 00.246-.288l-.692-4.5a.25.25 0 00-.247-.212H6.608z" clipRule="evenodd" /></svg>
                Imprimer les photos de preuve
              </button>
            )}
          </div>

          {/* Filtre section */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'
              }`}
            >
              Classe entière
            </button>
            {availableSections.map(section => (
              <button
                key={section}
                onClick={() => setSelectedFilter(section)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedFilter === section
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'
                }`}
              >
                {sectionNames[section]}
              </button>
            ))}
          </div>

          {filteredStudents.length === 0 ? (
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm p-10 text-center">
              <p className="text-slate-500 dark:text-zinc-400 italic">Aucun élève dans cette section.</p>
            </div>
          ) : (
            <>
              {/* Bloc 1 : Progression globale */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-slate-800 dark:text-zinc-200">Progression globale</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                      {filteredStudents.length} élève{filteredStudents.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  {avgStats && (
                    <div className="text-right">
                      <div>
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          {avgStats.avg}
                        </span>
                        <span className="text-base text-slate-400 dark:text-zinc-500">
                          /{avgStats.total}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">moy. par élève</p>
                    </div>
                  )}
                </div>

                {avgStats && (
                  <>
                    <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-3 mb-1.5">
                      <div
                        className="bg-blue-500 h-3 rounded-full transition-all"
                        style={{ width: `${avgStats.percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {avgStats.percent}% des compétences acquises en moyenne
                    </p>
                    {filteredStudents.length > 1 && (
                      <div className="flex gap-6 mt-4 pt-3 border-t border-slate-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-xs text-slate-500 dark:text-zinc-400">
                            Meilleur :{' '}
                            <span className="font-semibold text-slate-700 dark:text-zinc-300 tabular-nums">
                              {avgStats.max}/{avgStats.total}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-xs text-slate-500 dark:text-zinc-400">
                            Moins avancé :{' '}
                            <span className="font-semibold text-slate-700 dark:text-zinc-300 tabular-nums">
                              {avgStats.min}/{avgStats.total}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bloc 2 : Progression par domaine */}
              {domainStats.length > 0 && (
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm p-5">
                  <h2 className="font-bold text-slate-800 dark:text-zinc-200 mb-4">Progression par domaine</h2>
                  <div className="space-y-6">
                    {domainStats.map(program => (
                      <div key={program.programId}>
                        {domainStats.length > 1 && (
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-3">
                            {program.programName}
                          </p>
                        )}
                        <div className="space-y-3">
                          {program.domains.map(domain => (
                            <div key={domain.id}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300 truncate mr-4">
                                  {domain.name}
                                </span>
                                <span className="text-xs tabular-nums text-slate-600 dark:text-zinc-300 shrink-0">
                                  <span className="font-semibold">{domain.avg}</span>
                                  <span className="text-slate-400 dark:text-zinc-500">/{domain.total}</span>
                                  <span className="ml-1.5 text-slate-400 dark:text-zinc-500">({domain.percent}%)</span>
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-zinc-700 rounded-full h-2">
                                <div
                                  className="bg-indigo-500 h-2 rounded-full transition-all"
                                  style={{ width: `${domain.percent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bloc 3 : Top 10 plus acquises */}
              {skillRankings.top10.length > 0 && (
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <h2 className="font-bold text-slate-800 dark:text-zinc-200">Top 10 — Plus acquises</h2>
                  </div>
                  <ol className="space-y-3">
                    {skillRankings.top10.map((skill, i) => renderSkillRow(skill, i, 'bg-emerald-500'))}
                  </ol>
                </div>
              )}

              {/* Bloc 4 : Groupes de soutien */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm p-5">
                <h2 className="font-bold text-slate-800 dark:text-zinc-200 mb-5">Groupes de soutien</h2>

                {/* Groupes suggérés */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
                      Groupes suggérés
                    </h3>
                    <button
                      type="button"
                      onClick={() => openCreate('suggested')}
                      className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 font-bold text-sm leading-none">+</span>
                      Nouveau groupe
                    </button>
                  </div>

                  {suggestedGroups.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 italic">
                      Un groupe suggéré liste automatiquement les élèves les moins avancés sur un ensemble de compétences.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {suggestedGroups.map(group => {
                        const { ranked, added } = getSuggestedGroup(group);
                        const effectiveCount = ranked.length + added.length;
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => openEdit(group)}
                            className="w-full text-left border border-slate-200 dark:border-zinc-700 rounded-lg px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate mr-2">
                                {group.name || <span className="text-slate-400 dark:text-zinc-500 italic">Sans nom</span>}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300 shrink-0">
                                →
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                              {group.filterIds.length} filtre{group.filterIds.length !== 1 ? 's' : ''}
                              {group.filterIds.length > 0 && effectiveCount > 0 && (
                                <> · {effectiveCount} élève{effectiveCount !== 1 ? 's' : ''}</>
                              )}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-zinc-700 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
                      Groupes libres
                    </h3>
                    <button
                      type="button"
                      onClick={() => openCreate('free')}
                      className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 font-bold text-sm leading-none">+</span>
                      Nouveau groupe
                    </button>
                  </div>

                  {freeGroups.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 italic">
                      Composez des groupes librement en choisissant les élèves un à un.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {freeGroups.map(group => {
                        const groupStudents = students.filter(s => group.studentIds.includes(s.id));
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => openEdit(group)}
                            className="w-full text-left border border-slate-200 dark:border-zinc-700 rounded-lg px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate mr-2">
                                {group.name || <span className="text-slate-400 dark:text-zinc-500 italic">Sans nom</span>}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300 shrink-0">
                                →
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                              {groupStudents.length} élève{groupStudents.length !== 1 ? 's' : ''}
                              {groupStudents.length > 0 && (
                                <> · {groupStudents.slice(0, 3).map(s => s.firstName).join(', ')}{groupStudents.length > 3 ? '…' : ''}</>
                              )}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modale */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={handleModalBackdropClick}
        >
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header modale */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-700 shrink-0">
              <h2 className="font-bold text-slate-800 dark:text-zinc-200">
                {modal.group.type === 'suggested' ? 'Groupe suggéré' : 'Groupe libre'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fermer"
                className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Corps modale */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Nom */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                  Nom du groupe
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modal.group.name}
                  onChange={e => updateModal({ name: e.target.value })}
                  placeholder="Ex. : Groupe Gestes de l'écriture"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-lg text-sm text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {modal.group.type === 'suggested' && (() => {
                const availableScopes = allFilterScopes.filter(s => !modal.group.filterIds.includes(s.id));
                const searchLower = filterSearch.toLowerCase();
                const filteredBySearch = (type: FilterScope['type']) =>
                  availableScopes.filter(s => s.type === type && (!filterSearch || s.label.toLowerCase().includes(searchLower)));

                const suggested = getSuggestedGroup(modal.group);

                // Vivier d'élèves pris en compte : toute la classe (au moins 1 pour garder le stepper utilisable).
                const poolSize = Math.max(1, students.length);
                // Valeur toujours ramenée dans [1, poolSize] : évite que « + » ne fasse chuter la valeur
                // quand le nombre demandé dépasse le vivier disponible.
                const count = Math.min(Math.max(1, modal.group.maxStudents), poolSize);
                const setCount = (n: number) => updateModal({ maxStudents: Math.min(poolSize, Math.max(1, n)) });
                const stepBtn = "w-9 h-9 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent";

                return (
                  <>
                    {/* Nombre d'élèves — stepper +/− */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                        Nombre d'élèves à inclure
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-0 border border-slate-300 dark:border-zinc-600 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setCount(count - 1)}
                            disabled={count <= 1}
                            aria-label="Diminuer le nombre d'élèves"
                            className={stepBtn}
                          >
                            −
                          </button>
                          <span className="w-12 h-9 flex items-center justify-center text-sm font-bold tabular-nums text-slate-800 dark:text-zinc-200 border-x border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-700/50">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCount(count + 1)}
                            disabled={count >= poolSize}
                            aria-label="Augmenter le nombre d'élèves"
                            className={stepBtn}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm text-slate-600 dark:text-zinc-400">
                          élève{count > 1 ? 's' : ''} les moins avancés
                        </span>
                      </div>
                    </div>

                    {/* Filtres */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                        Filtres de compétences
                      </label>

                      {/* Chips des filtres sélectionnés */}
                      {modal.group.filterIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {modal.group.filterIds.map(fid => {
                            const scope = allFilterScopes.find(s => s.id === fid);
                            if (!scope) return null;
                            return (
                              <span
                                key={fid}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${chipClass(scope.type)}`}
                              >
                                {scope.label}
                                <button
                                  type="button"
                                  onClick={() => updateModal({ filterIds: modal.group.filterIds.filter(f => f !== fid) })}
                                  className="hover:opacity-60 font-bold ml-0.5"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Panneau de recherche inline */}
                      {availableScopes.length > 0 && (
                        filterDropdownOpen ? (
                          <div className="border border-slate-200 dark:border-zinc-600 rounded-lg overflow-hidden">
                            <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-600">
                              <input
                                autoFocus
                                type="text"
                                value={filterSearch}
                                onChange={e => setFilterSearch(e.target.value)}
                                placeholder="Rechercher domaine, sous-domaine ou compétence…"
                                className="flex-1 px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => { setFilterDropdownOpen(false); setFilterSearch(''); }}
                                className="text-xs px-2 py-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 shrink-0"
                              >
                                Annuler
                              </button>
                            </div>
                            <div className="max-h-56 overflow-y-auto">
                              {(['domain', 'subdomain', 'skill'] as FilterScope['type'][]).map(typeKey => {
                                const groupLabel = typeKey === 'domain' ? 'Domaines' : typeKey === 'subdomain' ? 'Sous-domaines' : 'Compétences';
                                const items = filteredBySearch(typeKey);
                                if (items.length === 0) return null;
                                return (
                                  <div key={typeKey}>
                                    <div className="px-3 py-1 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wide bg-slate-50/80 dark:bg-zinc-800/60 sticky top-0">
                                      {groupLabel}
                                    </div>
                                    {items.map(s => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                          updateModal({ filterIds: [...modal.group.filterIds, s.id] });
                                          setFilterDropdownOpen(false);
                                          setFilterSearch('');
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 whitespace-normal wrap-break-word leading-snug"
                                      >
                                        {s.label}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })}
                              {filterSearch && filteredBySearch('domain').length === 0 && filteredBySearch('subdomain').length === 0 && filteredBySearch('skill').length === 0 && (
                                <p className="px-3 py-4 text-xs text-slate-400 dark:text-zinc-500 italic text-center">
                                  Aucun résultat pour « {filterSearch} »
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setFilterDropdownOpen(true); setFilterSearch(''); }}
                            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white dark:bg-zinc-700 border border-dashed border-slate-300 dark:border-zinc-600 rounded-lg text-slate-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                          >
                            <span className="font-bold">+</span> Ajouter un filtre…
                          </button>
                        )
                      )}

                      {modal.group.filterIds.length === 0 && !filterDropdownOpen && (
                        <p className="text-xs text-slate-400 dark:text-zinc-500 italic mt-1">
                          Ajoutez au moins un filtre pour voir les résultats.
                        </p>
                      )}
                    </div>

                    {/* Composition du groupe */}
                    {modal.group.filterIds.length > 0 && (() => {
                      const excludedIds = modal.group.excludedStudentIds ?? [];
                      const addedIds = modal.group.addedStudentIds ?? [];
                      // Les élèves exclus sont déjà remplacés par les suivants dans « ranked ».
                      const computedVisible = suggested.ranked;
                      const addedStudentsList = suggested.added;
                      const effectiveIdSet = new Set([
                        ...computedVisible.map(r => r.student.id),
                        ...addedStudentsList.map(s => s.id),
                      ]);
                      const availableToAdd = students.filter(s => !effectiveIdSet.has(s.id));
                      const searchLower = studentSearch.toLowerCase();
                      const filteredToAdd = availableToAdd.filter(s =>
                        !studentSearch || `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchLower)
                      );

                      return (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                            Composition du groupe
                          </label>

                          {computedVisible.length === 0 && addedStudentsList.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-zinc-500 italic mb-2">Aucun élève dans la sélection actuelle.</p>
                          ) : (
                            <ol className="space-y-1.5 mb-3">
                              {computedVisible.map((r, i) => {
                                const pct = r.total > 0 ? Math.round(r.acquired / r.total * 100) : 0;
                                return (
                                  <li key={r.student.id} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 w-5 text-right shrink-0 tabular-nums">{i + 1}.</span>
                                    <span className="text-sm text-slate-700 dark:text-zinc-300 w-32 shrink-0 truncate">
                                      {r.student.firstName} {r.student.lastName}
                                    </span>
                                    <div className="flex-1 bg-slate-100 dark:bg-zinc-700 rounded-full h-1.5">
                                      <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs tabular-nums text-slate-500 dark:text-zinc-400 shrink-0 w-16 text-right">
                                      {r.acquired}/{r.total} ({pct}%)
                                    </span>
                                    <Tooltip content="Retirer du groupe (remplacé par l'élève suivant)" position="top-center" wrapperClassName="shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => updateModal({ excludedStudentIds: [...excludedIds, r.student.id] })}
                                        className="w-5 h-5 flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-red-400 dark:hover:text-red-400 font-bold text-sm rounded"
                                      >
                                        ×
                                      </button>
                                    </Tooltip>
                                  </li>
                                );
                              })}
                              {addedStudentsList.map((s, i) => (
                                <li key={s.id} className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 w-5 text-right shrink-0 tabular-nums">
                                    {computedVisible.length + i + 1}.
                                  </span>
                                  <span className="text-sm text-blue-600 dark:text-blue-400 w-32 shrink-0 truncate font-medium">
                                    {s.firstName} {s.lastName}
                                  </span>
                                  <span className="flex-1 text-xs text-blue-400 dark:text-blue-500 italic">
                                    ajouté manuellement
                                  </span>
                                  <Tooltip content="Retirer du groupe" position="top-center" wrapperClassName="shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => updateModal({ addedStudentIds: addedIds.filter(id => id !== s.id) })}
                                      className="w-5 h-5 flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-red-400 dark:hover:text-red-400 font-bold text-sm rounded"
                                    >
                                      ×
                                    </button>
                                  </Tooltip>
                                </li>
                              ))}
                            </ol>
                          )}

                          {/* Panneau ajout manuel */}
                          {availableToAdd.length > 0 && (
                            studentDropdownOpen ? (
                              <div className="border border-slate-200 dark:border-zinc-600 rounded-lg overflow-hidden">
                                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-600">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                    placeholder="Rechercher un élève…"
                                    className="flex-1 px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => { setStudentDropdownOpen(false); setStudentSearch(''); }}
                                    className="text-xs px-2 py-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 shrink-0"
                                  >
                                    Annuler
                                  </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {filteredToAdd.length === 0 ? (
                                    <p className="px-3 py-4 text-xs text-slate-400 dark:text-zinc-500 italic text-center">
                                      Aucun résultat pour « {studentSearch} »
                                    </p>
                                  ) : (
                                    filteredToAdd.map(s => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                          updateModal({
                                            addedStudentIds: [...addedIds, s.id],
                                            excludedStudentIds: excludedIds.filter(id => id !== s.id),
                                          });
                                          setStudentDropdownOpen(false);
                                          setStudentSearch('');
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                      >
                                        {s.firstName} {s.lastName}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setStudentDropdownOpen(true); setStudentSearch(''); }}
                                className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white dark:bg-zinc-700 border border-dashed border-slate-300 dark:border-zinc-600 rounded-lg text-slate-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              >
                                <span className="font-bold">+</span> Ajouter un élève manuellement
                              </button>
                            )
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

              {modal.group.type === 'free' && (() => {
                const groupStudents = students.filter(s => modal.group.studentIds.includes(s.id));
                const availableStudents = filteredStudents.filter(s => !modal.group.studentIds.includes(s.id));
                const searchLower = studentSearch.toLowerCase();
                const filteredAvailable = availableStudents.filter(s =>
                  !studentSearch || `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchLower)
                );

                return (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                      Élèves du groupe
                    </label>

                    {/* Chips élèves */}
                    {groupStudents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {groupStudents.map(s => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300"
                          >
                            {s.firstName} {s.lastName}
                            <button
                              type="button"
                              onClick={() => updateModal({ studentIds: modal.group.studentIds.filter(id => id !== s.id) })}
                              className="hover:text-red-500 dark:hover:text-red-400 font-bold ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Panneau de recherche élèves */}
                    {availableStudents.length > 0 && (
                      studentDropdownOpen ? (
                        <div className="border border-slate-200 dark:border-zinc-600 rounded-lg overflow-hidden">
                          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-600">
                            <input
                              autoFocus
                              type="text"
                              value={studentSearch}
                              onChange={e => setStudentSearch(e.target.value)}
                              placeholder="Rechercher un élève…"
                              className="flex-1 px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => { setStudentDropdownOpen(false); setStudentSearch(''); }}
                              className="text-xs px-2 py-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 shrink-0"
                            >
                              Annuler
                            </button>
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {filteredAvailable.length === 0 ? (
                              <p className="px-3 py-4 text-xs text-slate-400 dark:text-zinc-500 italic text-center">
                                Aucun résultat pour « {studentSearch} »
                              </p>
                            ) : (
                              filteredAvailable.map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    updateModal({ studentIds: [...modal.group.studentIds, s.id] });
                                    setStudentDropdownOpen(false);
                                    setStudentSearch('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  {s.firstName} {s.lastName}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setStudentDropdownOpen(true); setStudentSearch(''); }}
                          className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white dark:bg-zinc-700 border border-dashed border-slate-300 dark:border-zinc-600 rounded-lg text-slate-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          <span className="font-bold">+</span> Ajouter un élève…
                        </button>
                      )
                    )}

                    {groupStudents.length === 0 && availableStudents.length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-zinc-500 italic">
                        Aucun élève disponible dans la sélection actuelle.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer modale */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-zinc-700 shrink-0">
              {!modal.isNew ? (
                <button
                  type="button"
                  onClick={() => deleteGroup(modal.group.id)}
                  className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Supprimer
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveModal}
                  className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClassSynthesis;
