import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Student, Skill, Domain, SchoolProgram, Section, SupportGroup } from '../types';
import { getAllSkillIdsInDomain, sectionNames, sectionOrder, resolveSupportGroupStudentIds, buildFilterScopeSkillIds } from '../utils';
import { compressImage } from '../utils/imageUtils';
import StoredImage from '../images/StoredImage';
import { formatDateFR, todayLocalISO } from '../domain/dates';
import useModalDismiss from '../hooks/useModalDismiss';
import ConfirmationModal from './ConfirmationModal';

// ─── Types ───────────────────────────────────────────────────────────────────
type PhotoMode = 'none' | 'common' | 'per_student' | 'per_skill';
type SkillViewMode = 'tree' | 'list';
type Step = 1 | 2 | 3;

export interface MassValidationResult {
  studentIds: string[];
  skillIds: string[];
  date: string;
  getPhoto: (studentId: string, skillId: string) => string | null;
}

interface Props {
  students: Student[];
  schoolPrograms: SchoolProgram[];
  supportGroups: SupportGroup[];
  onConfirm: (result: MassValidationResult) => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const normalizeStr = (str: string): string =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface FlatSkill { skill: Skill; breadcrumb: string; }

const getAllFlatSkills = (programs: SchoolProgram[]): FlatSkill[] => {
  const result: FlatSkill[] = [];
  const processDomain = (domain: Domain, prefix: string) => {
    const breadcrumb = prefix ? `${prefix} › ${domain.name}` : domain.name;
    domain.skills.forEach(skill => result.push({ skill, breadcrumb }));
    domain.subDomains?.forEach(sd => processDomain(sd, breadcrumb));
  };
  programs.forEach(p => p.domains.forEach(d => processDomain(d, p.name)));
  return result;
};

const getAllSkillIdsInProgram = (program: SchoolProgram): string[] =>
  program.domains.flatMap(d => getAllSkillIdsInDomain(d));

const filterDomainByQuery = (domain: Domain, norm: string): Domain | null => {
  if (normalizeStr(domain.name).includes(norm)) return domain;
  const filteredSkills = domain.skills.filter(s => normalizeStr(s.name).includes(norm));
  const filteredSubs = (domain.subDomains ?? [])
    .map(sd => filterDomainByQuery(sd, norm))
    .filter((sd): sd is Domain => sd !== null);
  if (filteredSkills.length > 0 || filteredSubs.length > 0) {
    return { ...domain, skills: filteredSkills, subDomains: filteredSubs };
  }
  return null;
};

// ─── Icons ───────────────────────────────────────────────────────────────────
const XMarkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
  </svg>
);
const SearchIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);
const PhotoIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);
const CheckBadgeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12c0 1.357-.6 2.573-1.549 3.397a4.49 4.49 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.491 4.491 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);
const TreeViewIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
  </svg>
);
const ListViewIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h.5a.75.75 0 010 1.5h-.5A.75.75 0 012 4.75zm3 0a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H5.75A.75.75 0 015 4.75zM2 10a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5A.75.75 0 012 10zm3 0a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H5.75A.75.75 0 015 10zm-3 5.25a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zm3 0a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H5.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
  </svg>
);

// ─── Composants internes ──────────────────────────────────────────────────────
const IndeterminateCheckbox: React.FC<{
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  className?: string;
}> = ({ checked, indeterminate, onChange, className }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      className={`w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-400 cursor-pointer flex-shrink-0 ${className ?? ''}`}
    />
  );
};

const PhotoUploadInline: React.FC<{
  photo: string | null;
  onChangePhoto: (photo: string | null) => void;
  inputId: string;
  label: string;
  avatar?: string | null;
  initials?: string;
}> = ({ photo, onChangePhoto, inputId, label, avatar, initials }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => { const ref = await compressImage(reader.result as string); if (ref) onChangePhoto(ref); e.target.value = ''; };
    reader.readAsDataURL(file);
  };
  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-white dark:bg-zinc-700/50 rounded-md">
      {avatar !== undefined ? (
        avatar ? (
          <StoredImage src={avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-zinc-600 flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{initials}</span>
          </div>
        )
      ) : null}
      <span className="text-sm text-slate-700 dark:text-zinc-300 flex-1 truncate">{label}</span>
      {photo ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <StoredImage src={photo} alt="preuve" className="w-8 h-8 rounded object-cover border border-slate-200 dark:border-zinc-600" />
          <label htmlFor={inputId} className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
            Changer
            <input id={inputId} type="file" accept="image/*" className="sr-only" onChange={handleChange} />
          </label>
          <button type="button" onClick={() => onChangePhoto(null)} className="text-xs text-red-500 dark:text-red-400 hover:underline">×</button>
        </div>
      ) : (
        <label htmlFor={inputId} className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 flex-shrink-0">
          <PhotoIcon className="w-3.5 h-3.5" /> + Photo
          <input id={inputId} type="file" accept="image/*" className="sr-only" onChange={handleChange} />
        </label>
      )}
    </div>
  );
};

// ─── Composant récursif pour l'arborescence ───────────────────────────────────
const DomainRow: React.FC<{
  domain: Domain;
  selectedSkillIds: Set<string>;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onToggleDomain: (skillIds: string[]) => void;
  onToggleSkill: (skillId: string) => void;
  depth: number;
  forceExpand: boolean;
}> = ({ domain, selectedSkillIds, collapsedIds, onToggleCollapse, onToggleDomain, onToggleSkill, depth, forceExpand }) => {
  const allSkillIds = useMemo(() => getAllSkillIdsInDomain(domain), [domain]);
  const selectedCount = allSkillIds.filter(id => selectedSkillIds.has(id)).length;
  const isChecked = allSkillIds.length > 0 && selectedCount === allSkillIds.length;
  const isIndeterminate = selectedCount > 0 && !isChecked;
  const isCollapsed = !forceExpand && collapsedIds.has(domain.id);
  const hasChildren = domain.skills.length > 0 || (domain.subDomains?.length ?? 0) > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 pr-3 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700/30 cursor-pointer select-none"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => hasChildren && onToggleCollapse(domain.id)}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {hasChildren ? (
            <ChevronDownIcon className={`w-4 h-4 text-slate-400 dark:text-zinc-500 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} />
          ) : <span className="w-4" />}
        </span>
        <IndeterminateCheckbox checked={isChecked} indeterminate={isIndeterminate} onChange={() => onToggleDomain(allSkillIds)} />
        <span className={`text-sm text-slate-700 dark:text-zinc-300 leading-snug ${depth === 0 ? 'font-semibold' : depth === 1 ? 'font-medium' : ''}`}>
          {domain.name}
        </span>
        {selectedCount > 0 && (
          <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full px-1.5 py-0.5 flex-shrink-0">
            {selectedCount}/{allSkillIds.length}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <div>
          {domain.skills.map(skill => (
            <div
              key={skill.id}
              className={`flex items-center gap-2 py-1 pr-3 rounded-md cursor-pointer transition-colors ${selectedSkillIds.has(skill.id) ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/20'}`}
              style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}
              onClick={() => onToggleSkill(skill.id)}
            >
              <span className="w-4 flex-shrink-0" />
              <input
                type="checkbox"
                checked={selectedSkillIds.has(skill.id)}
                onChange={() => onToggleSkill(skill.id)}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-400 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-slate-600 dark:text-zinc-400 leading-snug">{skill.name}</span>
            </div>
          ))}
          {domain.subDomains?.map(sd => (
            <DomainRow
              key={sd.id}
              domain={sd}
              selectedSkillIds={selectedSkillIds}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              onToggleDomain={onToggleDomain}
              onToggleSkill={onToggleSkill}
              depth={depth + 1}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────
const MassValidationModal: React.FC<Props> = ({ students, schoolPrograms, supportGroups, onConfirm, onClose }) => {
  // ── État des étapes ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ── Étape 1 : sélection des élèves ──────────────────────────────
  const [selStudentIds, setSelStudentIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  // Groupes de soutien activés : sert à suggérer leurs compétences (filtres) à l'étape 2.
  const [selGroupIds, setSelGroupIds] = useState<Set<string>>(new Set());

  // ── Étape 2 : sélection des compétences ─────────────────────────
  const [selSkillIds, setSelSkillIds] = useState<Set<string>>(new Set());
  const [skillSearch, setSkillSearch] = useState('');
  const [skillViewMode, setSkillViewMode] = useState<SkillViewMode>('tree');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // ── Étape 3 : configuration ──────────────────────────────────────
  const [date, setDate] = useState(() => todayLocalISO());
  const [photoMode, setPhotoMode] = useState<PhotoMode>('none');
  const [commonPhoto, setCommonPhoto] = useState<string | null>(null);
  const [photoPerStudent, setPhotoPerStudent] = useState<Record<string, string | null>>({});
  const [photoPerSkill, setPhotoPerSkill] = useState<Record<string, string | null>>({});

  // Fermeture (Échap, croix) : dans la pile des modales, et confirmée dès qu'une saisie est en
  // cours (sinon élèves, compétences et photos choisis seraient perdus sans prévenir).
  const [confirmClose, setConfirmClose] = useState(false);
  const requestClose = () => {
    const hasWork = step > 1 || selStudentIds.size > 0 || selSkillIds.size > 0;
    if (hasWork) setConfirmClose(true); else onClose();
  };
  useModalDismiss(requestClose, !confirmClose, false);

  // ── Données calculées – Étape 1 ──────────────────────────────────
  const filteredStudents = useMemo(() => {
    const q = normalizeStr(studentSearch.trim());
    if (!q) return students;
    return students.filter(s =>
      normalizeStr(`${s.firstName} ${s.lastName}`).includes(q) ||
      normalizeStr(`${s.lastName} ${s.firstName}`).includes(q)
    );
  }, [students, studentSearch]);

  const groupedStudents = useMemo(() => {
    const map: Partial<Record<Section, Student[]>> = {};
    for (const s of filteredStudents) {
      if (!map[s.section]) map[s.section] = [];
      map[s.section]!.push(s);
    }
    return map;
  }, [filteredStudents]);

  // Table filtre → compétences (même schéma d'identifiants que l'onglet Classe).
  const filterScopeMap = useMemo(() => buildFilterScopeSkillIds(schoolPrograms), [schoolPrograms]);

  // Résout les identifiants de compétences ciblés par les filtres d'un groupe.
  const getGroupSkillIds = useCallback(
    (group: SupportGroup): string[] => {
      const set = new Set<string>();
      (group.filterIds || []).forEach(fid => filterScopeMap.get(fid)?.forEach(id => set.add(id)));
      return [...set];
    },
    [filterScopeMap]
  );

  // Groupes de soutien résolus en listes d'élèves (on n'affiche que les groupes non vides).
  const resolvedGroups = useMemo(
    () =>
      supportGroups
        .map(group => ({
          group,
          memberIds: resolveSupportGroupStudentIds(group, students, schoolPrograms),
          skillIds: getGroupSkillIds(group),
        }))
        .filter(g => g.memberIds.length > 0),
    [supportGroups, students, schoolPrograms, getGroupSkillIds]
  );

  // ── Données calculées – Étape 2 ──────────────────────────────────
  const allFlatSkills = useMemo(() => getAllFlatSkills(schoolPrograms), [schoolPrograms]);

  const flatSkillById = useMemo(() => {
    const map = new Map<string, FlatSkill>();
    allFlatSkills.forEach(fs => map.set(fs.skill.id, fs));
    return map;
  }, [allFlatSkills]);

  // Compétences suggérées : union des filtres des groupes de soutien activés à l'étape 1.
  const suggestedSkills = useMemo(() => {
    const seen = new Set<string>();
    const result: FlatSkill[] = [];
    resolvedGroups.forEach(({ group, skillIds }) => {
      if (!selGroupIds.has(group.id)) return;
      skillIds.forEach(id => {
        if (seen.has(id)) return;
        const fs = flatSkillById.get(id);
        if (fs) { seen.add(id); result.push(fs); }
      });
    });
    return result;
  }, [resolvedGroups, selGroupIds, flatSkillById]);

  const suggestedSkillIds = useMemo(() => suggestedSkills.map(fs => fs.skill.id), [suggestedSkills]);

  const filteredFlatSkills = useMemo(() => {
    const q = normalizeStr(skillSearch.trim());
    if (!q) return allFlatSkills;
    return allFlatSkills.filter(({ skill, breadcrumb }) =>
      normalizeStr(skill.name).includes(q) || normalizeStr(breadcrumb).includes(q)
    );
  }, [allFlatSkills, skillSearch]);

  const filteredTreePrograms = useMemo(() => {
    const q = normalizeStr(skillSearch.trim());
    return schoolPrograms
      .map(p => ({
        program: p,
        domains: q
          ? p.domains.map(d => filterDomainByQuery(d, q)).filter((d): d is Domain => d !== null)
          : p.domains,
      }))
      .filter(p => p.domains.length > 0);
  }, [schoolPrograms, skillSearch]);

  const forceExpand = skillSearch.trim().length > 0;

  // ── Données calculées – Étape 3 ──────────────────────────────────
  const selectedStudentsForStep3 = useMemo(
    () => students.filter(s => selStudentIds.has(s.id)),
    [students, selStudentIds]
  );
  const selectedSkillsForStep3 = useMemo(
    () => allFlatSkills.filter(fs => selSkillIds.has(fs.skill.id)).map(fs => fs.skill),
    [allFlatSkills, selSkillIds]
  );

  const totalValidations = selStudentIds.size * selSkillIds.size;

  // ── Handlers – élèves ────────────────────────────────────────────
  const toggleStudent = useCallback((id: string) => {
    setSelStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSection = useCallback((section: Section, sectionStudents: Student[]) => {
    const sIds = sectionStudents.map(s => s.id);
    setSelStudentIds(prev => {
      const allSel = sIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSel) sIds.forEach(id => next.delete(id));
      else sIds.forEach(id => next.add(id));
      return next;
    });
  }, []);

  // Sélectionne / désélectionne tous les élèves d'un groupe de soutien.
  // Mémorise aussi l'état du groupe pour suggérer ses compétences (filtres) à l'étape 2.
  const toggleGroup = useCallback((groupId: string, memberIds: string[]) => {
    let activating = false;
    setSelStudentIds(prev => {
      const allSel = memberIds.length > 0 && memberIds.every(id => prev.has(id));
      activating = !allSel;
      const next = new Set(prev);
      if (allSel) memberIds.forEach(id => next.delete(id));
      else memberIds.forEach(id => next.add(id));
      return next;
    });
    setSelGroupIds(prev => {
      const next = new Set(prev);
      if (activating) next.add(groupId); else next.delete(groupId);
      return next;
    });
  }, []);

  const selectAllStudents = useCallback(() => {
    setSelStudentIds(prev => {
      const next = new Set(prev);
      filteredStudents.forEach(s => next.add(s.id));
      return next;
    });
  }, [filteredStudents]);

  const deselectAllStudents = useCallback(() => {
    setSelStudentIds(prev => {
      const next = new Set(prev);
      filteredStudents.forEach(s => next.delete(s.id));
      return next;
    });
  }, [filteredStudents]);

  // ── Handlers – compétences ───────────────────────────────────────
  const toggleSkill = useCallback((id: string) => {
    setSelSkillIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleDomain = useCallback((skillIds: string[]) => {
    setSelSkillIds(prev => {
      const allSel = skillIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSel) skillIds.forEach(id => next.delete(id));
      else skillIds.forEach(id => next.add(id));
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllSkills = useCallback(() => {
    setSelSkillIds(prev => {
      const next = new Set(prev);
      filteredFlatSkills.forEach(({ skill }) => next.add(skill.id));
      return next;
    });
  }, [filteredFlatSkills]);

  const deselectAllSkills = useCallback(() => {
    setSelSkillIds(prev => {
      const next = new Set(prev);
      filteredFlatSkills.forEach(({ skill }) => next.delete(skill.id));
      return next;
    });
  }, [filteredFlatSkills]);

  // Ajoute en une fois toutes les compétences suggérées par les groupes de soutien.
  const selectSuggestedSkills = useCallback(() => {
    setSelSkillIds(prev => {
      const next = new Set(prev);
      suggestedSkillIds.forEach(id => next.add(id));
      return next;
    });
  }, [suggestedSkillIds]);

  const allSuggestedSelected = suggestedSkillIds.length > 0 && suggestedSkillIds.every(id => selSkillIds.has(id));

  // ── Confirmation ─────────────────────────────────────────────────
  const handleConfirm = () => {
    const getPhoto = (studentId: string, skillId: string): string | null => {
      if (photoMode === 'common') return commonPhoto;
      if (photoMode === 'per_student') return photoPerStudent[studentId] ?? null;
      if (photoMode === 'per_skill') return photoPerSkill[skillId] ?? null;
      return null;
    };
    onConfirm({ studentIds: Array.from(selStudentIds), skillIds: Array.from(selSkillIds), date, getPhoto });
  };

  // ── Photo commune upload ─────────────────────────────────────────
  const handleCommonPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => { const ref = await compressImage(reader.result as string); if (ref) setCommonPhoto(ref); e.target.value = ''; };
    reader.readAsDataURL(file);
  };

  // ── Navigation ───────────────────────────────────────────────────
  const goToStep = (s: Step) => { if (s < step) setStep(s); };

  // ─────────────────────────────────────────────────────────────────
  // RENDU – Indicateur d'étapes
  // ─────────────────────────────────────────────────────────────────
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 py-3 px-6 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0 bg-slate-50 dark:bg-zinc-800/60">
      {([1, 2, 3] as Step[]).map((s, i) => {
        const isPast = step > s;
        const isCurrent = step === s;
        return (
          <React.Fragment key={s}>
            <button
              onClick={() => goToStep(s)}
              disabled={!isPast}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isCurrent
                  ? 'bg-blue-500 text-white shadow-sm'
                  : isPast
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer'
                    : 'text-slate-400 dark:text-zinc-600 cursor-default'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${
                isCurrent ? 'border-white' : isPast ? 'border-blue-500 text-blue-500' : 'border-slate-300 dark:border-zinc-600'
              }`}>
                {isPast ? '✓' : s}
              </span>
              <span className="hidden sm:inline">
                {s === 1 ? 'Élèves' : s === 2 ? 'Compétences' : 'Configuration'}
              </span>
            </button>
            {i < 2 && (
              <div className={`h-px w-8 flex-shrink-0 transition-colors ${isPast ? 'bg-blue-400' : 'bg-slate-300 dark:bg-zinc-600'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // RENDU – Étape 1 : sélection des élèves
  // ─────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="flex flex-col h-full max-w-xl mx-auto w-full">
      {/* Barre d'outils */}
      <div className="p-4 border-b border-slate-200 dark:border-zinc-700 space-y-3 flex-shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            placeholder="Rechercher un élève..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button onClick={selectAllStudents} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              Tout sélectionner
            </button>
            <span className="text-xs text-slate-300 dark:text-zinc-600">|</span>
            <button onClick={deselectAllStudents} className="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:underline">
              Tout désélectionner
            </button>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
            {selStudentIds.size} sélectionné{selStudentIds.size !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Liste des élèves groupée par section */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Groupes de soutien — sélection rapide */}
        {resolvedGroups.length > 0 && (
          <div className="mb-4">
            <div className="px-1 pb-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
              Groupes de soutien
            </div>
            <div className="space-y-1">
              {resolvedGroups.map(({ group, memberIds, skillIds }) => {
                const selCount = memberIds.filter(id => selStudentIds.has(id)).length;
                const isAllSel = selCount === memberIds.length;
                const isPartSel = selCount > 0 && !isAllSel;
                return (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700/60 transition-colors select-none"
                    onClick={() => toggleGroup(group.id, memberIds)}
                  >
                    <IndeterminateCheckbox checked={isAllSel} indeterminate={isPartSel} onChange={() => toggleGroup(group.id, memberIds)} />
                    <span className="text-sm font-medium text-slate-700 dark:text-zinc-200 flex-1 truncate">
                      {group.name || <span className="italic text-slate-400 dark:text-zinc-500">Groupe sans nom</span>}
                    </span>
                    {skillIds.length > 0 && (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 flex-shrink-0">
                        {skillIds.length} comp.
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${group.type === 'suggested' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'}`}>
                      {group.type === 'suggested' ? 'Suggéré' : 'Libre'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 flex-shrink-0">
                      {selCount}/{memberIds.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {filteredStudents.length === 0 ? (
          <p className="text-center text-sm text-slate-400 dark:text-zinc-500 py-10">Aucun élève trouvé.</p>
        ) : (
          sectionOrder.map(section => {
            const sectionStudents = groupedStudents[section];
            if (!sectionStudents?.length) return null;
            const selCount = sectionStudents.filter(s => selStudentIds.has(s.id)).length;
            const isAllSel = selCount === sectionStudents.length;
            const isPartSel = selCount > 0 && !isAllSel;
            return (
              <div key={section} className="mb-3">
                <div
                  className="flex items-center gap-3 px-3 py-2 bg-slate-100 dark:bg-zinc-700/60 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors select-none"
                  onClick={() => toggleSection(section, sectionStudents)}
                >
                  <IndeterminateCheckbox
                    checked={isAllSel}
                    indeterminate={isPartSel}
                    onChange={() => toggleSection(section, sectionStudents)}
                  />
                  <span className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex-1">{sectionNames[section]}</span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400">
                    {selCount}/{sectionStudents.length} élève{sectionStudents.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 pl-2">
                  {sectionStudents.map(student => {
                    const isSelected = selStudentIds.has(student.id);
                    return (
                      <div
                        key={student.id}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer transition-colors select-none ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-900/25' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/30'
                        }`}
                        onClick={() => toggleStudent(student.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudent(student.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-400 cursor-pointer flex-shrink-0"
                        />
                        {student.photo ? (
                          <StoredImage src={student.photo} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-zinc-600 flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                              {student.firstName[0]}{student.lastName[0]}
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-slate-700 dark:text-zinc-300">
                          <span className="font-medium">{student.lastName}</span> {student.firstName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // RENDU – Étape 2 : sélection des compétences
  // ─────────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Barre d'outils */}
      <div className="p-4 border-b border-slate-200 dark:border-zinc-700 space-y-3 flex-shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              placeholder="Rechercher une compétence ou un domaine..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {/* Basculer arborescence / liste */}
          <div className="flex rounded-lg border border-slate-300 dark:border-zinc-600 overflow-visible flex-shrink-0">
            <div className="relative group/tooltip inline-flex">
              <button
                onClick={() => setSkillViewMode('tree')}
                className={`px-3 py-2 transition-colors ${skillViewMode === 'tree' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}
              >
                <TreeViewIcon className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-200 invisible group-hover/tooltip:visible group-focus-within/tooltip:visible z-50 pointer-events-none font-normal whitespace-nowrap">
                Vue arborescence
              </div>
            </div>
            <div className="relative group/tooltip inline-flex">
              <button
                onClick={() => setSkillViewMode('list')}
                className={`px-3 py-2 border-l border-slate-300 dark:border-zinc-600 transition-colors ${skillViewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}
              >
                <ListViewIcon className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-200 invisible group-hover/tooltip:visible group-focus-within/tooltip:visible z-50 pointer-events-none font-normal whitespace-nowrap">
                Vue liste
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button onClick={selectAllSkills} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              Tout sélectionner
            </button>
            <span className="text-xs text-slate-300 dark:text-zinc-600">|</span>
            <button onClick={deselectAllSkills} className="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:underline">
              Tout désélectionner
            </button>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
            {selSkillIds.size} compétence{selSkillIds.size !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Contenu arborescence ou liste */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Compétences suggérées par les groupes de soutien sélectionnés */}
        {suggestedSkills.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/15 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                <span aria-hidden>✨</span>
                Compétences suggérées ({suggestedSkills.length})
              </div>
              <button
                onClick={selectSuggestedSkills}
                disabled={allSuggestedSelected}
                className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default"
              >
                {allSuggestedSelected ? 'Toutes ajoutées' : 'Tout sélectionner'}
              </button>
            </div>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 mb-2 leading-snug">
              Issues des filtres des groupes de soutien choisis à l'étape précédente.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedSkills.map(({ skill, breadcrumb }) => {
                const isSelected = selSkillIds.has(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    title={breadcrumb}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors select-none ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white dark:bg-zinc-800 border-amber-300 dark:border-amber-700/60 text-slate-700 dark:text-zinc-300 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                  >
                    <span className="flex-shrink-0">{isSelected ? '✓' : '+'}</span>
                    <span className="truncate max-w-[16rem]">{skill.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {skillViewMode === 'list' ? (
          filteredFlatSkills.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-zinc-500 py-10">Aucune compétence trouvée.</p>
          ) : (
            <div className="space-y-0.5">
              {filteredFlatSkills.map(({ skill, breadcrumb }) => {
                const isSelected = selSkillIds.has(skill.id);
                return (
                  <div
                    key={skill.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors select-none ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/25' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/30'
                    }`}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSkill(skill.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-400 cursor-pointer flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 dark:text-zinc-300 truncate">{skill.name}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{breadcrumb}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          filteredTreePrograms.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-zinc-500 py-10">Aucune compétence trouvée.</p>
          ) : (
            filteredTreePrograms.map(({ program, domains }) => {
              const allIds = getAllSkillIdsInProgram(program);
              const selCount = allIds.filter(id => selSkillIds.has(id)).length;
              const isChecked = allIds.length > 0 && selCount === allIds.length;
              const isIndeterminate = selCount > 0 && !isChecked;
              return (
                <div key={program.id} className="mb-4">
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-100 dark:bg-zinc-700/60 rounded-lg select-none">
                    <IndeterminateCheckbox
                      checked={isChecked}
                      indeterminate={isIndeterminate}
                      onChange={() => toggleDomain(allIds)}
                    />
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex-1">{program.name}</span>
                    {selCount > 0 && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full px-2 py-0.5">
                        {selCount}/{allIds.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    {domains.map(domain => (
                      <DomainRow
                        key={domain.id}
                        domain={domain}
                        selectedSkillIds={selSkillIds}
                        collapsedIds={collapsedIds}
                        onToggleCollapse={toggleCollapse}
                        onToggleDomain={toggleDomain}
                        onToggleSkill={toggleSkill}
                        depth={0}
                        forceExpand={forceExpand}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // RENDU – Étape 3 : configuration
  // ─────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto w-full p-6 space-y-6">

        {/* Date */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-2">
            Date de validation
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className="px-3 py-2 text-sm border border-slate-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Mode photo */}
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3">Photos (optionnel)</p>
          <div className="space-y-2">
            {(
              [
                { mode: 'none' as PhotoMode,       label: 'Aucune photo' },
                { mode: 'common' as PhotoMode,     label: 'Une photo commune pour toutes les validations' },
                { mode: 'per_student' as PhotoMode, label: `Une photo par élève (${selStudentIds.size}) — s'applique à toutes ses compétences` },
                { mode: 'per_skill' as PhotoMode,   label: `Une photo par compétence (${selSkillIds.size}) — s'applique à tous les élèves` },
              ]
            ).map(({ mode, label }) => (
              <label
                key={mode}
                className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-all ${
                  photoMode === mode
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <input
                  type="radio"
                  name="photoMode"
                  value={mode}
                  checked={photoMode === mode}
                  onChange={() => setPhotoMode(mode)}
                  className="text-blue-500 border-slate-300 dark:border-zinc-600 focus:ring-blue-400"
                />
                <span className="text-sm text-slate-700 dark:text-zinc-300">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Zone d'upload – photo commune */}
        {photoMode === 'common' && (
          <div className="p-4 border-2 border-dashed border-slate-300 dark:border-zinc-600 rounded-xl text-center">
            {commonPhoto ? (
              <div className="flex flex-col items-center gap-3">
                <StoredImage src={commonPhoto} alt="Photo commune" className="h-28 w-auto rounded-xl object-cover border border-slate-200 dark:border-zinc-600 shadow-sm" />
                <div className="flex gap-4 text-sm">
                  <label className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Changer
                    <input type="file" accept="image/*" className="sr-only" onChange={handleCommonPhotoChange} />
                  </label>
                  <button type="button" onClick={() => setCommonPhoto(null)} className="text-red-500 dark:text-red-400 hover:underline">
                    Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer group block py-4">
                <PhotoIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-600 group-hover:text-blue-400 dark:group-hover:text-blue-500 transition-colors" />
                <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 group-hover:underline">Importer la photo commune</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Partagée pour toutes les validations</p>
                <input type="file" accept="image/*" className="sr-only" onChange={handleCommonPhotoChange} />
              </label>
            )}
          </div>
        )}

        {/* Zone d'upload – photo par élève */}
        {photoMode === 'per_student' && (
          <div className="space-y-1.5 bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide px-1 mb-2">
              Photo par élève
            </p>
            {selectedStudentsForStep3.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 px-1">Aucun élève sélectionné.</p>
            ) : selectedStudentsForStep3.map(student => (
              <PhotoUploadInline
                key={student.id}
                photo={photoPerStudent[student.id] ?? null}
                onChangePhoto={photo => setPhotoPerStudent(prev => ({ ...prev, [student.id]: photo }))}
                inputId={`photo-student-${student.id}`}
                label={`${student.lastName} ${student.firstName}`}
                avatar={student.photo}
                initials={`${student.firstName[0]}${student.lastName[0]}`}
              />
            ))}
          </div>
        )}

        {/* Zone d'upload – photo par compétence */}
        {photoMode === 'per_skill' && (
          <div className="space-y-1.5 bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide px-1 mb-2">
              Photo par compétence
            </p>
            {selectedSkillsForStep3.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 px-1">Aucune compétence sélectionnée.</p>
            ) : selectedSkillsForStep3.map(skill => (
              <PhotoUploadInline
                key={skill.id}
                photo={photoPerSkill[skill.id] ?? null}
                onChangePhoto={photo => setPhotoPerSkill(prev => ({ ...prev, [skill.id]: photo }))}
                inputId={`photo-skill-${skill.id}`}
                label={skill.name}
              />
            ))}
          </div>
        )}

        {/* Récapitulatif */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-4">Récapitulatif</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{selStudentIds.size}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">élève{selStudentIds.size !== 1 ? 's' : ''}</p>
            </div>
            <span className="text-2xl text-slate-300 dark:text-zinc-600 font-light">×</span>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{selSkillIds.size}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">compétence{selSkillIds.size !== 1 ? 's' : ''}</p>
            </div>
            <span className="text-2xl text-slate-300 dark:text-zinc-600 font-light">=</span>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalValidations}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">validation{totalValidations !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {date && (
            <p className="text-center text-xs text-slate-500 dark:text-zinc-400 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800/50">
              Date : {formatDateFR(date, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-900"
      aria-modal="true"
      role="dialog"
      aria-label="Validation en masse"
    >
      {confirmClose && (
        <ConfirmationModal
          title="Abandonner la validation en masse ?"
          message="Les élèves, les compétences et les photos choisis seront perdus."
          confirmText="Abandonner"
          cancelText="Continuer"
          onConfirm={onClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
      {/* En-tête */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <CheckBadgeIcon className="w-6 h-6 text-blue-500 flex-shrink-0" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200">Validation en masse</h2>
        </div>
        <button
          onClick={requestClose}
          className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
          aria-label="Fermer"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </header>

      {/* Indicateur d'étapes */}
      {renderStepIndicator()}

      {/* Corps — zone scrollable propre à chaque étape */}
      <div className="flex-1 min-h-0 flex flex-col">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {/* Pied de page – navigation */}
      <footer className="border-t border-slate-200 dark:border-zinc-700 px-6 py-4 flex items-center justify-between flex-shrink-0 bg-white dark:bg-zinc-900">
        <button
          onClick={step === 1 ? onClose : () => setStep(prev => (prev - 1) as Step)}
          className="px-5 py-2 text-sm font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
        >
          {step === 1 ? 'Annuler' : '← Retour'}
        </button>

        {/* Résumé central */}
        <div className="text-sm text-slate-500 dark:text-zinc-400 text-center">
          {step >= 1 && selStudentIds.size > 0 && (
            <span className="font-medium text-blue-600 dark:text-blue-400">{selStudentIds.size} élève{selStudentIds.size > 1 ? 's' : ''}</span>
          )}
          {step >= 2 && selSkillIds.size > 0 && (
            <span> × <span className="font-medium text-blue-600 dark:text-blue-400">{selSkillIds.size} compétence{selSkillIds.size > 1 ? 's' : ''}</span></span>
          )}
        </div>

        {step < 3 ? (
          <button
            onClick={() => setStep(prev => (prev + 1) as Step)}
            disabled={step === 1 ? selStudentIds.size === 0 : selSkillIds.size === 0}
            className="px-5 py-2 text-sm font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Suivant →
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={!date || selStudentIds.size === 0 || selSkillIds.size === 0}
            className="px-6 py-2 text-sm font-semibold bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <CheckBadgeIcon className="w-4 h-4" />
            Valider {totalValidations > 0 ? `(${totalValidations})` : ''}
          </button>
        )}
      </footer>
    </div>
  );
};

export default MassValidationModal;
