import React, { useState, useMemo, useCallback } from 'react';
import { Student, Proficiency, SchoolProgram, Skill, SkillAcquisitionDetails, ReferenceAge, Domain } from '../types';
import { PROFICIENCY_COLORS, REFERENCE_AGE_DOT_COLORS } from '../constants';
import { getAllSkillIdsInDomain } from '../utils';
import { grantSkills, isAcquired } from '../domain/acquisitions';
import AcquisitionDetailModal from './AcquisitionDetailModal';
import ConfirmationModal from './ConfirmationModal';
import Tooltip from './Tooltip';
import { formatDateFR } from '../domain/dates';

interface StudentDetailProps {
  student: Student;
  schoolPrograms: SchoolProgram[];
  onUpdateSkill: (studentId: string, skillId: string, details: SkillAcquisitionDetails) => void;
  onBatchUpdateSkills: (studentId: string, updates: Record<string, SkillAcquisitionDetails>) => void;
  highlightedSkillId: string | null;
  onHighlightSkill: (skillId: string | null) => void;
  onDeselectStudent?: () => void;
}

const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c0-.69.56-1.25 1.25-1.25h10c.69 0 1.25.56 1.25 1.25v6.5c0 .69-.56 1.25-1.25 1.25h-10c-.69 0-1.25-.56-1.25-1.25v-6.5z" clipRule="evenodd" />
  </svg>
);

const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 012 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909-.48-1.921a.75.75 0 00-.998-.61l-3.226 1.007-1.964-2.844a.75.75 0 00-1.282-.01L2.5 11.06zM15 6.75a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
  </svg>
);

const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
    </svg>
);

const CheckBadgeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12c0 1.357-.6 2.573-1.549 3.397a4.49 4.49 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.491 4.491 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
  </svg>
);

const ChevronIcon: React.FC<{ className?: string; isCollapsed: boolean }> = ({ className, isCollapsed }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`${className} transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
);

const MagnifyingGlassIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11ZM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9Z" clipRule="evenodd" />
  </svg>
);

interface DomainDisplayProps {
  domain: Domain;
  level: number;
  student: Student;
  collapsedIds: Set<string>;
  toggleCollapse: (id: string) => void;
  highlightedSkillId: string | null;
  onHighlightSkill: (skillId: string | null) => void;
  handleToggleOrOpenModal: (skill: Skill) => void;
  handleEditDetails: (e: React.MouseEvent, skill: Skill) => void;
  onValidateDomain: (skillIds: string[], domainName: string) => void;
  onDevalidateDomain: (skillIds: string[], domainName: string) => void;
  onBatchUpdateSkills: (studentId: string, updates: Record<string, SkillAcquisitionDetails>) => void;
  skillLayout: 'rows' | 'columns';
}

const DomainDisplay: React.FC<DomainDisplayProps> = React.memo(({
  domain,
  level,
  student,
  collapsedIds,
  toggleCollapse,
  highlightedSkillId,
  onHighlightSkill,
  handleToggleOrOpenModal,
  handleEditDetails,
  onValidateDomain,
  onDevalidateDomain,
  onBatchUpdateSkills,
  skillLayout,
}) => {
    const isCollapsed = collapsedIds.has(domain.id);

    const domainSkillIds = useMemo(() => getAllSkillIdsInDomain(domain), [domain]);

    const areAllAcquired = useMemo(() => {
        if (domainSkillIds.length === 0) return false;
        return domainSkillIds.every(id => student.skills[id]?.proficiency === Proficiency.Acquired);
    }, [domainSkillIds, student.skills]);

    return (
      <div className={`${level > 0 ? 'ml-4 mt-4' : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-sm'}`}>
        <div className={`flex items-center justify-between group/domain-header ${level === 0 ? 'p-4 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-700' : 'pt-4'}`}>
           <div className="flex items-center gap-3 flex-grow min-w-0">
               <button
                    onClick={() => toggleCollapse(domain.id)}
                    className="flex items-center gap-2 text-left min-w-0 flex-grow"
                    aria-expanded={!isCollapsed}
                >
                    <ChevronIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400 flex-shrink-0 transition-transform" isCollapsed={isCollapsed} />
                    <h3 className={`font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate ${level === 0 ? 'text-lg text-slate-700 dark:text-zinc-200' : 'text-md text-slate-600 dark:text-zinc-300'}`}>{domain.name}</h3>
                </button>
           </div>
           {domainSkillIds.length > 0 && (
             <div className="flex items-center gap-2 opacity-0 group-hover/domain-header:opacity-100 group-focus-within/domain-header:opacity-100 pointer-coarse:opacity-100 transition-opacity focus-within:opacity-100">
                 {areAllAcquired ? (
                     <Tooltip content="Dévalider tout le domaine" position="top-center">
                         <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onDevalidateDomain(domainSkillIds, domain.name);
                              }}
                              className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-800/60 rounded-full flex items-center gap-1.5 transition-colors"
                          >
                              <XCircleIcon className="w-4 h-4" />
                              <span className="hidden sm:inline">Tout dévalider</span>
                         </button>
                     </Tooltip>
                 ) : (
                     <Tooltip content="Valider tout le domaine" position="top-center">
                         <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onValidateDomain(domainSkillIds, domain.name);
                              }}
                              className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-800/60 rounded-full flex items-center gap-1.5 transition-colors"
                          >
                              <CheckBadgeIcon className="w-4 h-4" />
                              <span className="hidden sm:inline">Tout valider</span>
                         </button>
                     </Tooltip>
                 )}
             </div>
           )}
        </div>

        {!isCollapsed && (
            <>
                {skillLayout === 'columns' ? (
                    <div className="grid grid-cols-5 gap-1.5 p-2">
                        {domain.skills.map(skill => {
                            const details = student.skills[skill.id] || { proficiency: Proficiency.NotAcquired };
                            const isAcquired = details.proficiency === Proficiency.Acquired;
                            return (
                                <div
                                    key={skill.id}
                                    className={`relative group/col-skill rounded-md border p-1.5 flex flex-col gap-1 transition-colors ${
                                        highlightedSkillId === skill.id ? 'ring-2 ring-blue-300 dark:ring-blue-600 bg-blue-50 dark:bg-blue-900/30' :
                                        isAcquired ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                                        'bg-white border-slate-200 dark:bg-zinc-800 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/50'
                                    }`}
                                    onClick={() => onHighlightSkill(skill.id)}
                                    data-interactive="true"
                                >
                                    {skill.referenceAges && skill.referenceAges.length > 0 && (
                                        <div className="flex items-center gap-0.5">
                                            {skill.referenceAges.map(age => (
                                                <div key={age} className={`w-2 h-2 rounded-full flex-shrink-0 ${REFERENCE_AGE_DOT_COLORS[age]}`} />
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-tight line-clamp-3 flex-grow cursor-pointer">
                                        {skill.name}
                                    </p>
                                    <div className="flex items-center gap-1 mt-auto">
                                        {isAcquired && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditDetails(e, skill); }}
                                                className="p-0.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover/col-skill:opacity-100 group-focus-within/col-skill:opacity-100 pointer-coarse:opacity-100 transition-opacity flex-shrink-0"
                                                aria-label="Modifier les détails"
                                            >
                                                <PencilIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleOrOpenModal(skill); }}
                                            className={`flex-1 text-center px-1 py-0.5 text-xs font-medium rounded-full border transition-colors ${PROFICIENCY_COLORS[details.proficiency]}`}
                                        >
                                            {isAcquired ? '✓' : '✗'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <ul>
                    {domain.skills.map((skill) => {
                        const details = student.skills[skill.id] || { proficiency: Proficiency.NotAcquired };
                        const isAcquired = details.proficiency === Proficiency.Acquired;

                        const rowClass = highlightedSkillId === skill.id
                            ? 'bg-blue-100 dark:bg-blue-900/60 ring-2 ring-blue-300 dark:ring-blue-700'
                            : 'hover:bg-slate-100 dark:hover:bg-zinc-700/50';

                        return (
                        <li
                            key={skill.id}
                            className={`group/skill-row p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors rounded-md ${rowClass}`}
                            data-interactive="true"
                        >
                            <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={() => onHighlightSkill(skill.id)}>
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2">
                                        {skill.referenceAges && skill.referenceAges.length > 0 && (
                                            <Tooltip content={`Âges de référence : ${skill.referenceAges.join(', ')}`} position="bottom">
                                                <div className="flex items-center gap-1.5">
                                                    {skill.referenceAges.map(age => (
                                                        <div
                                                            key={age}
                                                            className={`w-3 h-3 rounded-full flex-shrink-0 ${REFERENCE_AGE_DOT_COLORS[age]}`}
                                                        />
                                                    ))}
                                                </div>
                                            </Tooltip>
                                        )}
                                        <span className="text-slate-600 dark:text-zinc-300">{skill.name}</span>
                                        {skill.description && (
                                            <div className="relative group/icon flex items-center">
                                                <button className="flex items-center" aria-label="Voir la description">
                                                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 dark:text-zinc-500 cursor-pointer" />
                                                </button>
                                                <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-white text-slate-600 dark:bg-zinc-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-sm rounded-md shadow-lg opacity-0 group-hover/icon:opacity-100 group-focus-within/icon:opacity-100 transition-opacity duration-200 invisible group-hover/icon:visible group-focus-within/icon:visible z-20 pointer-events-none whitespace-normal break-words">
                                                    {skill.description}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {isAcquired && (details.date || details.photo) && (
                                        <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400 space-y-1">
                                        {details.date && (
                                            <p className="flex items-center">
                                            <CalendarIcon className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                            Validé le {formatDateFR(details.date, { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </p>
                                        )}
                                        {details.photo && (
                                            <p className="flex items-center">
                                            <PhotoIcon className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                            Preuve par photo ajoutée.
                                            </p>
                                        )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                            {isAcquired && (
                                <button
                                onClick={(e) => handleEditDetails(e, skill)}
                                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-600 hover:text-slate-700 dark:hover:text-zinc-200 z-10"
                                aria-label="Modifier les détails"
                                >
                                <PencilIcon className="w-4 h-4"/>
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleOrOpenModal(skill);
                                }}
                                className={`w-32 text-center px-3 py-1.5 text-sm font-medium rounded-full border transition-transform transform hover:scale-105 z-10 ${
                                    PROFICIENCY_COLORS[details.proficiency]
                                }`}
                            >
                                {details.proficiency}
                            </button>
                            </div>
                        </li>
                        );
                    })}
                    </ul>
                )}
                {domain.subDomains.map(subDomain => (
                    <DomainDisplay
                        key={subDomain.id}
                        domain={subDomain}
                        level={level + 1}
                        student={student}
                        collapsedIds={collapsedIds}
                        toggleCollapse={toggleCollapse}
                        highlightedSkillId={highlightedSkillId}
                        onHighlightSkill={onHighlightSkill}
                        handleToggleOrOpenModal={handleToggleOrOpenModal}
                        handleEditDetails={handleEditDetails}
                        onValidateDomain={onValidateDomain}
                        onDevalidateDomain={onDevalidateDomain}
                        onBatchUpdateSkills={onBatchUpdateSkills}
                        skillLayout={skillLayout}
                    />
                ))}
            </>
        )}
      </div>
    );
});

const normalizeStr = (str: string) => str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const StudentDetail: React.FC<StudentDetailProps> = ({ student, schoolPrograms, onUpdateSkill, onBatchUpdateSkills, highlightedSkillId, onHighlightSkill, onDeselectStudent }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    skill: Skill | null;
    details: SkillAcquisitionDetails | null;
  }>({ isOpen: false, skill: null, details: null });

  const [devalidationModalState, setDevalidationModalState] = useState<{
    isOpen: boolean;
    skill: Skill | null;
  }>({ isOpen: false, skill: null });

  const [domainValidationModalState, setDomainValidationModalState] = useState<{
      isOpen: boolean;
      skillIds: string[];
      domainName: string;
  }>({ isOpen: false, skillIds: [], domainName: '' });

  const [domainDevalidationModalState, setDomainDevalidationModalState] = useState<{
      isOpen: boolean;
      skillIds: string[];
      domainName: string;
  }>({ isOpen: false, skillIds: [], domainName: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'list' | 'summary'>('tree');
  const [filterStatus, setFilterStatus] = useState<'all' | 'acquired' | 'not_acquired'>('all');
  const [sortBy, setSortBy] = useState<'program' | 'name' | 'date'>('program');
  const [skillLayout, setSkillLayout] = useState<'rows' | 'columns'>('rows');

  const handleContainerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a, [data-interactive="true"]')) {
      return;
    }
    onHighlightSkill(null);
  };

  const allCollapsibleIds = useMemo(() => {
    const ids: string[] = [];
    const recurse = (domains: Domain[]) => {
      for (const domain of domains) {
        ids.push(domain.id);
        if (domain.subDomains && domain.subDomains.length > 0) {
          recurse(domain.subDomains);
        }
      }
    };
    schoolPrograms.forEach(p => {
        ids.push(p.id);
        recurse(p.domains)
    });
    return ids;
  }, [schoolPrograms]);

  const areAllCollapsed = allCollapsibleIds.length > 0 && allCollapsibleIds.every(id => collapsedIds.has(id));

  const handleToggleAll = () => {
    if (areAllCollapsed) {
      setCollapsedIds(new Set());
    } else {
      setCollapsedIds(new Set(allCollapsibleIds));
    }
  };

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  }, []);

  const filteredSchoolPrograms = useMemo(() => {
    const normalizedTerm = searchTerm.trim() ? normalizeStr(searchTerm.trim()) : '';
    const hasFilters = normalizedTerm || filterStatus !== 'all' || sortBy !== 'program';
    if (!hasFilters) return schoolPrograms;

    const filterSortDomains = (domains: Domain[]): Domain[] =>
      domains.reduce((acc, domain) => {
        const subDomains = filterSortDomains(domain.subDomains || []);

        let skills = domain.skills;
        if (filterStatus !== 'all') {
          skills = skills.filter(s => {
            const isAcq = student.skills[s.id]?.proficiency === Proficiency.Acquired;
            return filterStatus === 'acquired' ? isAcq : !isAcq;
          });
        }

        if (normalizedTerm) {
          const domainMatch = normalizeStr(domain.name).includes(normalizedTerm);
          const expMatch = domain.expectations?.some(e => normalizeStr(e).includes(normalizedTerm)) || false;
          const matchingSkills = skills.filter(s => normalizeStr(s.name).includes(normalizedTerm));
          if (!domainMatch && !expMatch && matchingSkills.length === 0 && subDomains.length === 0) return acc;
          skills = domainMatch || expMatch ? skills : matchingSkills;
        }

        if (sortBy === 'name') skills = [...skills].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        else if (sortBy === 'date') skills = [...skills].sort((a, b) => {
          const da = student.skills[a.id]?.date || '';
          const db = student.skills[b.id]?.date || '';
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return db.localeCompare(da);
        });

        if (skills.length > 0 || subDomains.length > 0) {
          acc.push({ ...domain, skills, subDomains });
        }
        return acc;
      }, [] as Domain[]);

    return schoolPrograms.reduce((acc, program) => {
      const domains = filterSortDomains(program.domains);
      if (domains.length > 0) acc.push({ ...program, domains });
      return acc;
    }, [] as SchoolProgram[]);
  }, [schoolPrograms, searchTerm, filterStatus, sortBy, student.skills]);

  const allSkillsFlat = useMemo(() => {
    type SkillEntry = { skill: Skill; breadcrumb: string; details: SkillAcquisitionDetails };
    const result: SkillEntry[] = [];
    const traverse = (domains: Domain[], path: string[]) => {
      for (const domain of domains) {
        for (const skill of domain.skills) {
          result.push({ skill, breadcrumb: path.concat(domain.name).join(' › '), details: student.skills[skill.id] || { proficiency: Proficiency.NotAcquired } });
        }
        traverse(domain.subDomains || [], path.concat(domain.name));
      }
    };
    schoolPrograms.forEach(p => traverse(p.domains, [p.name]));
    return result;
  }, [schoolPrograms, student.skills]);

  const filteredFlatSkills = useMemo(() => {
    const normalizedTerm = searchTerm.trim() ? normalizeStr(searchTerm.trim()) : '';
    let skills = allSkillsFlat;
    if (filterStatus === 'acquired') skills = skills.filter(e => e.details.proficiency === Proficiency.Acquired);
    else if (filterStatus === 'not_acquired') skills = skills.filter(e => e.details.proficiency !== Proficiency.Acquired);
    if (normalizedTerm) skills = skills.filter(e => normalizeStr(e.skill.name).includes(normalizedTerm) || normalizeStr(e.breadcrumb).includes(normalizedTerm));
    if (sortBy === 'name') return [...skills].sort((a, b) => a.skill.name.localeCompare(b.skill.name, 'fr'));
    if (sortBy === 'date') return [...skills].sort((a, b) => {
      const da = a.details.date || ''; const db = b.details.date || '';
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return db.localeCompare(da);
    });
    return skills;
  }, [allSkillsFlat, searchTerm, filterStatus, sortBy]);

  const summaryData = useMemo(() => {
    return schoolPrograms.flatMap(program =>
      program.domains.map(domain => {
        const allSkillsList: Array<{ skill: Skill; details: SkillAcquisitionDetails }> = [];
        const collectSkills = (d: Domain) => {
          d.skills.forEach(s => allSkillsList.push({ skill: s, details: student.skills[s.id] || { proficiency: Proficiency.NotAcquired } }));
          (d.subDomains || []).forEach(collectSkills);
        };
        collectSkills(domain);
        const acquiredSkills = allSkillsList
          .filter(s => s.details.proficiency === Proficiency.Acquired)
          .sort((a, b) => (b.details.date || '').localeCompare(a.details.date || ''));
        return {
          domain,
          totalSkills: allSkillsList.length,
          acquiredSkills,
          acquiredCount: acquiredSkills.length,
          percent: allSkillsList.length > 0 ? Math.round(acquiredSkills.length / allSkillsList.length * 100) : 0
        };
      })
    );
  }, [schoolPrograms, student.skills]);

  const { overallAcquiredCount, overallTotalCount } = useMemo(() => {
    let total = 0; let acquired = 0;
    const count = (domains: Domain[]) => {
      for (const d of domains) {
        total += d.skills.length;
        acquired += d.skills.filter(s => student.skills[s.id]?.proficiency === Proficiency.Acquired).length;
        count(d.subDomains || []);
      }
    };
    schoolPrograms.forEach(p => count(p.domains));
    return { overallAcquiredCount: acquired, overallTotalCount: total };
  }, [schoolPrograms, student.skills]);

  const ageStats = useMemo(() => {
    const stats: { [key in ReferenceAge]: { acquired: number; total: number } } = {
      [ReferenceAge.Under4]: { acquired: 0, total: 0 },
      [ReferenceAge.At4]: { acquired: 0, total: 0 },
      [ReferenceAge.Over4]: { acquired: 0, total: 0 },
    };
    const countSkills = (domains: Domain[]) => {
      for (const domain of domains) {
        for (const skill of domain.skills) {
          for (const age of skill.referenceAges) {
            stats[age].total++;
            if (student.skills[skill.id]?.proficiency === Proficiency.Acquired) {
              stats[age].acquired++;
            }
          }
        }
        countSkills(domain.subDomains || []);
      }
    };
    schoolPrograms.forEach(p => countSkills(p.domains));
    return stats;
  }, [schoolPrograms, student.skills]);

  const handleToggleOrOpenModal = useCallback((skill: Skill) => {
    const currentDetails = student.skills[skill.id] || { proficiency: Proficiency.NotAcquired };
    if (currentDetails.proficiency === Proficiency.Acquired) {
       setDevalidationModalState({ isOpen: true, skill: skill });
    } else {
      setModalState({ isOpen: true, skill, details: null });
    }
  }, [student.skills]);

  const handleEditDetails = useCallback((e: React.MouseEvent, skill: Skill) => {
      e.stopPropagation();
      const currentDetails = student.skills[skill.id];
      if (currentDetails) {
          setModalState({ isOpen: true, skill, details: currentDetails });
      }
  }, [student.skills]);

  const handleCloseModal = () => {
    setModalState({ isOpen: false, skill: null, details: null });
    setDomainValidationModalState({ isOpen: false, skillIds: [], domainName: '' });
  };

  const handleConfirmDevalidation = () => {
    if (devalidationModalState.skill) {
        onUpdateSkill(student.id, devalidationModalState.skill.id, { proficiency: Proficiency.NotAcquired });
    }
    setDevalidationModalState({ isOpen: false, skill: null });
  };

  const handleCancelDevalidation = () => {
    setDevalidationModalState({ isOpen: false, skill: null });
  };

  const handleSaveModal = (data: { date: string; photo: string | null }) => {
    if (modalState.skill) {
      const existing = student.skills[modalState.skill.id];
      onUpdateSkill(student.id, modalState.skill.id, {
        proficiency: Proficiency.Acquired,
        date: data.date,
        photo: data.photo,
        // Modifier une acquisition existante conserve la section d'origine (ex. acquise en PS).
        section: (isAcquired(existing) && existing.section) || student.section
      });
    }
    handleCloseModal();
  };

  const handleValidateDomain = useCallback((skillIds: string[], domainName: string) => {
      setDomainValidationModalState({ isOpen: true, skillIds, domainName });
  }, []);

  const handleDevalidateDomain = useCallback((skillIds: string[], domainName: string) => {
      setDomainDevalidationModalState({ isOpen: true, skillIds, domainName });
  }, []);

  const handleSaveDomainValidation = (data: { date: string; photo: string | null }) => {
      // Les compétences déjà acquises du domaine sont ignorées (date, photo et section conservées).
      const { skills, granted } = grantSkills(student.skills, domainValidationModalState.skillIds, {
          date: data.date,
          photo: data.photo,
          section: student.section,
      });
      const updates: Record<string, SkillAcquisitionDetails> = {};
      granted.forEach(skillId => { updates[skillId] = skills[skillId]; });
      if (granted.length) onBatchUpdateSkills(student.id, updates);
      handleCloseModal();
  };

  const handleConfirmDomainDevalidation = () => {
      const updates: Record<string, SkillAcquisitionDetails> = {};
      domainDevalidationModalState.skillIds.forEach(skillId => {
          updates[skillId] = { proficiency: Proficiency.NotAcquired };
      });
      onBatchUpdateSkills(student.id, updates);
      setDomainDevalidationModalState({ isOpen: false, skillIds: [], domainName: '' });
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900" onClick={handleContainerClick}>
        <div className="max-w-4xl mx-auto">
          <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-2 min-w-0">
                  {onDeselectStudent && (
                      <Tooltip content="Retour à la synthèse de la classe" position="bottom-center">
                          <button
                              onClick={onDeselectStudent}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                  <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                              </svg>
                          </button>
                      </Tooltip>
                  )}
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-200 truncate">
                      Compétences de {student.firstName}
                  </h1>
              </div>
              {viewMode === 'tree' && schoolPrograms.length > 0 && (
                  <button
                      onClick={handleToggleAll}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex-shrink-0"
                  >
                      {areAllCollapsed ? 'Tout déplier' : 'Tout replier'}
                  </button>
              )}
          </header>

          {viewMode !== 'summary' && (
          <div className="mb-4 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="search"
              placeholder="Rechercher une compétence ou un domaine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-200 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:placeholder-zinc-400"
            />
          </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-medium">
              {(['tree', 'list', 'summary'] as const).map((mode, i) => {
                const labels = { tree: 'Arborescence', list: 'Liste', summary: 'Synthèse' };
                return (
                  <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200 dark:border-zinc-700' : ''} ${viewMode === mode ? 'bg-blue-500 text-white' : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}>
                    {labels[mode]}
                  </button>
                );
              })}
            </div>

            {viewMode !== 'summary' && (
              <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-medium">
                {(['all', 'acquired', 'not_acquired'] as const).map((f, i) => {
                  const labels = { all: 'Tous', acquired: '✓ Acquis', not_acquired: '✗ Non acquis' };
                  const activeColors = { all: 'bg-blue-500 text-white', acquired: 'bg-green-500 text-white', not_acquired: 'bg-red-500 text-white' };
                  return (
                    <button key={f} onClick={() => setFilterStatus(f)} className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200 dark:border-zinc-700' : ''} ${filterStatus === f ? activeColors[f] : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}>
                      {labels[f]}
                    </button>
                  );
                })}
              </div>
            )}

            {viewMode !== 'summary' && (
              <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-medium">
                {(['program', 'name', 'date'] as const).map((s, i) => {
                  const labels = { program: 'Programme', name: 'Nom A-Z', date: 'Date' };
                  return (
                    <button key={s} onClick={() => setSortBy(s)} className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200 dark:border-zinc-700' : ''} ${sortBy === s ? 'bg-slate-600 text-white dark:bg-zinc-500' : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}>
                      {labels[s]}
                    </button>
                  );
                })}
              </div>
            )}
            {viewMode === 'tree' && (
              <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden text-xs font-medium">
                {(['rows', 'columns'] as const).map((layout, i) => {
                  const labels = { rows: 'Lignes', columns: 'Colonnes' };
                  return (
                    <button key={layout} onClick={() => setSkillLayout(layout)} className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-slate-200 dark:border-zinc-700' : ''} ${skillLayout === layout ? 'bg-slate-600 text-white dark:bg-zinc-500' : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}>
                      {labels[layout]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {viewMode === 'tree' && (
            <div className="space-y-8">
              {filteredSchoolPrograms.length > 0 ? (
                  filteredSchoolPrograms.map((program) => (
                      <div key={program.id} className="space-y-4">
                          <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                               <button onClick={() => toggleCollapse(program.id)} className="flex items-center gap-2 text-left w-full group" aria-expanded={!collapsedIds.has(program.id)}>
                                  <ChevronIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400 flex-shrink-0" isCollapsed={collapsedIds.has(program.id)} />
                                  <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">{program.name}</h2>
                               </button>
                          </div>
                          {!collapsedIds.has(program.id) && (
                              <div className="space-y-6 pl-2">
                                  {program.domains.map(domain =>
                                      <DomainDisplay
                                          key={domain.id}
                                          domain={domain}
                                          level={0}
                                          student={student}
                                          collapsedIds={collapsedIds}
                                          toggleCollapse={toggleCollapse}
                                          highlightedSkillId={highlightedSkillId}
                                          onHighlightSkill={onHighlightSkill}
                                          handleToggleOrOpenModal={handleToggleOrOpenModal}
                                          handleEditDetails={handleEditDetails}
                                          onValidateDomain={handleValidateDomain}
                                          onDevalidateDomain={handleDevalidateDomain}
                                          onBatchUpdateSkills={onBatchUpdateSkills}
                                          skillLayout={skillLayout}
                                      />
                                  )}
                              </div>
                          )}
                      </div>
                  ))
              ) : (
                  <div className="text-center py-10 px-4 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700">
                      <p className="text-slate-500 dark:text-zinc-400">Aucune compétence ou catégorie ne correspond à vos critères.</p>
                  </div>
              )}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-2">
              {filteredFlatSkills.length > 0 ? (
                filteredFlatSkills.map(({ skill, breadcrumb, details }) => {
                  const isAcquired = details.proficiency === Proficiency.Acquired;
                  return (
                    <div key={skill.id} className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{skill.name}</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">{breadcrumb}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isAcquired && details.date && (
                          <span className="text-xs text-slate-400 dark:text-zinc-500">{formatDate(details.date)}</span>
                        )}
                        {isAcquired && (
                          <button
                            onClick={(e) => handleEditDetails(e, skill)}
                            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-600 hover:text-slate-700 dark:hover:text-zinc-200"
                            aria-label="Modifier les détails"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleOrOpenModal(skill)}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${isAcquired ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-800/60' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-800/60'}`}
                        >
                          {isAcquired ? 'Acquis' : 'Non acquis'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 px-4 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700">
                  <p className="text-slate-500 dark:text-zinc-400">Aucune compétence ne correspond à vos critères.</p>
                </div>
              )}
            </div>
          )}

          {viewMode === 'summary' && (
            <div>
              <div className="mb-6 p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-slate-800 dark:text-zinc-200">Progression globale</h2>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{overallAcquiredCount}<span className="text-slate-400 dark:text-zinc-500 text-base font-normal">/{overallTotalCount}</span></span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-2.5 mb-1">
                  <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{width: overallTotalCount > 0 ? `${Math.round(overallAcquiredCount / overallTotalCount * 100)}%` : '0%'}} />
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{overallTotalCount > 0 ? Math.round(overallAcquiredCount / overallTotalCount * 100) : 0}% des compétences acquises</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(Object.entries(ageStats) as [ReferenceAge, { acquired: number; total: number }][]).map(([age, data]) => {
                    const dotColor = REFERENCE_AGE_DOT_COLORS[age];
                    return (
                      <div key={age} className="bg-slate-50 dark:bg-zinc-700/50 rounded-lg p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                          <span className="text-xs text-slate-600 dark:text-zinc-400 leading-tight">{age}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 tabular-nums">
                          {data.acquired}<span className="font-normal text-slate-400 dark:text-zinc-500">/{data.total}</span>
                        </p>
                        <div className="w-full bg-slate-200 dark:bg-zinc-600 rounded-full h-1 mt-1.5">
                          <div className={`h-1 rounded-full ${dotColor}`} style={{width: data.total > 0 ? `${Math.round(data.acquired / data.total * 100)}%` : '0%'}} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summaryData.map(({ domain, acquiredSkills, acquiredCount, totalSkills, percent }) => (
                  <div key={domain.id} className={`bg-white dark:bg-zinc-800 rounded-xl border shadow-sm p-4 ${acquiredCount === totalSkills && totalSkills > 0 ? 'border-green-300 dark:border-green-700' : 'border-slate-200 dark:border-zinc-700'}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-slate-800 dark:text-zinc-200 text-sm leading-tight">{domain.name}</h3>
                      <span className="text-sm font-bold text-slate-600 dark:text-zinc-300 flex-shrink-0 tabular-nums">{acquiredCount}/{totalSkills}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-1.5 mb-3">
                      <div className={`h-1.5 rounded-full transition-all ${acquiredCount === totalSkills && totalSkills > 0 ? 'bg-green-500' : 'bg-blue-500'}`} style={{width: `${percent}%`}} />
                    </div>
                    {acquiredSkills.length > 0 ? (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {acquiredSkills.map(({ skill, details }) => (
                          <li key={skill.id} className="flex items-center gap-2 text-xs">
                            <CheckBadgeIcon className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-zinc-300 flex-1 min-w-0 truncate">{skill.name}</span>
                            {details.date && <span className="text-slate-400 dark:text-zinc-500 flex-shrink-0">{formatDate(details.date)}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-zinc-500 italic">Aucune compétence acquise</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {modalState.isOpen && modalState.skill && (
        <AcquisitionDetailModal
          skillName={modalState.skill.name}
          initialDetails={modalState.details}
          onClose={handleCloseModal}
          onSave={handleSaveModal}
        />
      )}
      {domainValidationModalState.isOpen && (
          <AcquisitionDetailModal
              skillName={`Tout le domaine : ${domainValidationModalState.domainName}`}
              initialDetails={null}
              onClose={handleCloseModal}
              onSave={handleSaveDomainValidation}
          />
      )}
      {devalidationModalState.isOpen && devalidationModalState.skill && (
        <ConfirmationModal
            title="Dévalider la compétence"
            message={`Voulez-vous marquer la compétence "${devalidationModalState.skill.name}" comme 'Non acquise' ? La date et la photo associées seront supprimées.`}
            onConfirm={handleConfirmDevalidation}
            onCancel={handleCancelDevalidation}
            confirmText="Dévalider"
        />
      )}
      {domainDevalidationModalState.isOpen && (
        <ConfirmationModal
            title="Dévalider tout le domaine"
            message={`Voulez-vous marquer toutes les compétences du domaine "${domainDevalidationModalState.domainName}" comme 'Non acquises' ? Toutes les dates et photos associées seront supprimées pour ce domaine.`}
            onConfirm={handleConfirmDomainDevalidation}
            onCancel={() => setDomainDevalidationModalState({ isOpen: false, skillIds: [], domainName: '' })}
            confirmText="Tout dévalider"
        />
      )}
    </>
  );
};

export default StudentDetail;
