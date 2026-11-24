import React, { useState, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { addImageToZip, importImageFromZip } from '../images/imageArchive';
import { normalizePrograms } from '../fileFormat/normalize';
import { SchoolProgram, Domain, Skill, ReferenceAge } from '../types';
import { REFERENCE_AGE_DOT_COLORS } from '../constants';
import ConfirmationModal from './ConfirmationModal';
import TextInputModal from './TextInputModal';
import SkillFormModal from './SkillFormModal';
import DomainFormModal from './DomainFormModal';
import ExportProgramsModal from './ExportSkillsModal';
import MoveElementsModal from './MoveElementsModal';
import BatchSkillsActionBar from './BatchSkillsActionBar';
import { getDescendantIds } from '../utils';
import { allTreeIds, ancestorIds, descendantIds, moveTreeItems, neighborId, resolveSelection, TreeSelection } from '../domain/skillTree';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import Tooltip from './Tooltip';
import { toast } from '../utils/toast';
import StoredImage from '../images/StoredImage';

type ModalState =
  | { type: 'addProgram' }
  | { type: 'editProgram'; program: SchoolProgram }
  | { type: 'deleteProgram'; program: SchoolProgram }
  | { type: 'addDomain'; programId: string; parentDomainId?: string; isSubDomain: boolean }
  | { type: 'editDomain'; domain: Domain; isSubDomain: boolean }
  | { type: 'deleteDomain'; domain: Domain }
  | { type: 'addSkill'; domainId: string }
  | { type: 'editSkill'; domainId: string; skill: Skill }
  | { type: 'deleteSkill'; domainId: string; skill: Skill }
  | { type: 'export' }
  | { type: 'move'; items: { id: string; type: 'skill' | 'domain' }[] }
  | { type: 'batchDelete'; selection: TreeSelection }
  | { type: 'none' };

type DropPosition = 'top' | 'bottom' | 'inside' | null;

// --- ICONS ---
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg>);
const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" /></svg>);
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>);
const FolderPlusIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25V8.75A1.75 1.75 0 0 0 16.25 7H10.56a.75.75 0 0 1-.53-.22L8.22 4.97A1.75 1.75 0 0 0 6.99 4.5H3.75a.75.75 0 0 0-.75.75V15.25c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V8.75a.25.25 0 0 0-.25-.25H8.75a.75.75 0 0 1-.75-.75V4.75A.75.75 0 0 1 8.75 4h.74l1.84 1.84a.75.75 0 0 0 .53.22H16.25a.25.25 0 0 1 .25.25v.5h-3.28a.75.75 0 0 0-.53.22L11.22 9H4.75a.75.75 0 0 1-.75-.75V4.75c0-.414.336-.75.75-.75h2.24l1.84 1.84c.196.196.46.31.74.31H13a.75.75 0 0 0 .75-.75V4.75A1.75 1.75 0 0 0 12.01 3H3.75Z" /></svg>);
const ExportIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>);
const ImportIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
const ChevronIcon: React.FC<{ className?: string; isCollapsed: boolean }> = ({ className, isCollapsed }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`${className} transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>);
const MagnifyingGlassIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11ZM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9Z" clipRule="evenodd" /></svg>);
const FolderArrowDownIcon: React.FC<{ className?: string }> = ({ className }) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}> <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /> <path fillRule="evenodd" d="M10 9a.75.75 0 01.75.75v2.69l1.22-1.22a.75.75 0 111.06 1.06l-2.5 2.5a.75.75 0 01-1.06 0l-2.5-2.5a.75.75 0 111.06-1.06l1.22 1.22V9.75A.75.75 0 0110 9z" clipRule="evenodd" /> </svg>);
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z"/><path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z"/></svg>);
const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd"/></svg>);
const EyeSlashIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd"/><path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z"/></svg>);

interface SkillsViewProps {
  programs: SchoolProgram[];
  setPrograms: (updater: (prev: SchoolProgram[]) => SchoolProgram[]) => void;
  /** Supprime programmes, domaines et compétences, avec les acquisitions des élèves (une seule opération). */
  onDeleteItems: (selection: TreeSelection) => void;
  onImportPrograms: (programs: SchoolProgram[]) => void;
}

// --- Recursive State Updaters ---
const addDomainRecursive = (domains: Domain[] | undefined, newDomain: Domain, parentId: string): Domain[] => (domains || []).map(d => d.id === parentId ? { ...d, subDomains: [...(d.subDomains || []), newDomain] } : { ...d, subDomains: addDomainRecursive(d.subDomains, newDomain, parentId) });
const editDomainRecursive = (domains: Domain[] | undefined, domainId: string, data: { name: string, expectations: string[] }): Domain[] => (domains || []).map(d => d.id === domainId ? { ...d, name: data.name, expectations: data.expectations } : { ...d, subDomains: editDomainRecursive(d.subDomains, domainId, data) });
const addSkillRecursive = (domains: Domain[] | undefined, domainId: string, newSkill: Skill): Domain[] => (domains || []).map(d => d.id === domainId ? { ...d, skills: [...(d.skills || []), newSkill] } : { ...d, subDomains: addSkillRecursive(d.subDomains, domainId, newSkill) });
const editSkillRecursive = (domains: Domain[] | undefined, domainId: string, updatedSkill: Skill): Domain[] => (domains || []).map(d => d.id === domainId ? { ...d, skills: (d.skills || []).map(s => s.id === updatedSkill.id ? updatedSkill : s) } : { ...d, subDomains: editSkillRecursive(d.subDomains, domainId, updatedSkill) });

// Suppression et déplacement : voir domain/skillTree.ts (validés et testés).

const plural = (n: number, singular: string, pluralForm: string) => `${n} ${n > 1 ? pluralForm : singular}`;
/** Résumé de ce qui sera supprimé (contenu compris). */
const describeDeletion = (sel: TreeSelection): string => {
    const parts = [
        sel.programIds.length && plural(sel.programIds.length, 'programme', 'programmes'),
        sel.domainIds.length && plural(sel.domainIds.length, 'domaine', 'domaines'),
        sel.skillIds.length && plural(sel.skillIds.length, 'compétence', 'compétences'),
    ].filter(Boolean);
    return parts.length === 0
        ? 'Aucun élément entièrement sélectionné.'
        : `Supprimer ${parts.join(', ')} (avec leur contenu) ? Les acquisitions des élèves sur ces compétences seront aussi supprimées. Vous pourrez annuler (Ctrl+Z).`;
};

const deepCloneProgramWithNewIds = (program: SchoolProgram): SchoolProgram => {
    const cloneDomain = (domain: Domain): Domain => ({
        ...domain,
        id: crypto.randomUUID(),
        skills: domain.skills.map(skill => ({ ...skill, id: crypto.randomUUID() })),
        subDomains: (domain.subDomains || []).map(cloneDomain),
    });
    return {
        ...program,
        id: crypto.randomUUID(),
        name: `Copie de ${program.name}`,
        enabled: true,
        domains: program.domains.map(cloneDomain),
    };
};

const SkillsView: React.FC<SkillsViewProps> = ({ programs, setPrograms, onDeleteItems, onImportPrograms }) => {
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const importFileRef = useRef<HTMLInputElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [skillLayout, setSkillLayout] = useState<'rows' | 'columns'>('rows');

  const isBatchModeActive = selectedIds.size > 0;

  // --- Data & Filtering ---
  const filteredPrograms = useMemo(() => {
    if (!searchTerm.trim()) return programs;
    const term = searchTerm.toLowerCase();

    const filterDomains = (ds: Domain[]): Domain[] => ds.reduce((acc, d) => {
        const subDomains = filterDomains(d.subDomains || []);
        const skillsMatch = d.skills.some(s => s.name.toLowerCase().includes(term));
        const domainMatch = d.name.toLowerCase().includes(term);
        if (domainMatch || skillsMatch || subDomains.length > 0) {
            acc.push({ ...d, subDomains });
        }
        return acc;
    }, [] as Domain[]);

    return programs.reduce((acc, p) => {
        const domains = filterDomains(p.domains);
        if (p.name.toLowerCase().includes(term) || domains.length > 0) {
            acc.push({ ...p, domains });
        }
        return acc;
    }, [] as SchoolProgram[]);
  }, [programs, searchTerm]);

  // Éléments affichés (la recherche en masque) : « Tout sélectionner » ne coche que ceux-là (M3).
  const visibleIds = useMemo(() => allTreeIds(filteredPrograms), [filteredPrograms]);

  // --- Selection Logic ---
  const toggleSelection = (id: string, childrenIds: string[] = []) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        const isSelected = newSet.has(id);
        const all = [id, ...childrenIds];
        if (isSelected) {
            all.forEach(i => newSet.delete(i));
            // Un élément décoché décoche aussi ses parents : ils ne sont plus entièrement sélectionnés (M1)
            ancestorIds(programs, id).forEach(a => newSet.delete(a));
        } else {
            all.forEach(i => newSet.add(i));
        }
        return newSet;
    });
  };

  const handleSelectAll = (isChecked: boolean) => setSelectedIds(isChecked ? new Set(visibleIds) : new Set());

  const allSelectionState = useMemo((): 'checked' | 'unchecked' | 'indeterminate' => {
      if (selectedIds.size === 0) return 'unchecked';
      if (visibleIds.every(id => selectedIds.has(id))) return 'checked';
      return 'indeterminate';
  }, [selectedIds, visibleIds]);

  /** Retire de la sélection un élément supprimé et tout son contenu. */
  const dropFromSelection = (ids: string[]) => setSelectedIds(prev => {
      const gone = new Set(ids.flatMap(id => [id, ...descendantIds(programs, id)]));
      return new Set([...prev].filter(id => !gone.has(id)));
  });

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
        selectAllCheckboxRef.current.indeterminate = allSelectionState === 'indeterminate';
    }
  }, [allSelectionState]);

  // --- Collapse Logic ---
  const allCollapsibleIds = useMemo(() => {
    const ids = new Set<string>();
    const recurse = (ds: Domain[]) => ds.forEach(d => { ids.add(d.id); if(d.subDomains) recurse(d.subDomains); });
    programs.forEach(p => { ids.add(p.id); recurse(p.domains); });
    return Array.from(ids);
  }, [programs]);

  const handleToggleAllCollapse = () => {
    const areAllCollapsed = allCollapsibleIds.every(id => collapsedIds.has(id));
    setCollapsedIds(areAllCollapsed ? new Set() : new Set(allCollapsibleIds));
  };

  // --- Handlers ---
  const closeModal = () => setModal({ type: 'none' });
  const handleAddProgram = (name: string) => { setPrograms(p => [...p, { id: crypto.randomUUID(), name, domains: [] }]); closeModal(); };
  const handleEditProgram = (name: string) => { if (modal.type === 'editProgram') setPrograms(p => p.map(prog => prog.id === modal.program.id ? { ...prog, name } : prog)); closeModal(); };

  // Supprimer un élément précis supprime CET élément, même si d'autres sont cochés (M2).
  const handleDeleteProgram = () => {
       if (modal.type === 'deleteProgram') {
           onDeleteItems({ programIds: [modal.program.id], domainIds: [], skillIds: [] });
           dropFromSelection([modal.program.id]);
       }
       closeModal();
  };

  const handleSaveDomain = (data: {name: string, expectations: string[]}) => {
    if (modal.type === 'addDomain') {
        const newDomain: Domain = { id: crypto.randomUUID(), name: data.name, expectations: data.expectations, skills: [], subDomains: [] };
        if (modal.parentDomainId) {
            setPrograms(progs => progs.map(p => ({ ...p, domains: addDomainRecursive(p.domains, newDomain, modal.parentDomainId!) })));
        } else {
            setPrograms(progs => progs.map(p => p.id === modal.programId ? { ...p, domains: [...(p.domains || []), newDomain] } : p));
        }
    } else if (modal.type === 'editDomain') {
        setPrograms(progs => progs.map(p => ({ ...p, domains: editDomainRecursive(p.domains, modal.domain.id, data) })));
    }
    closeModal();
  };

  const handleDeleteDomain = () => {
      if (modal.type === 'deleteDomain') {
          onDeleteItems({ programIds: [], domainIds: [modal.domain.id], skillIds: [] });
          dropFromSelection([modal.domain.id]);
      }
      closeModal();
  };

  const handleSaveSkill = (data: { name: string; referenceAges: ReferenceAge[]; image: string | null; description: string; }) => {
    if (modal.type === 'addSkill') {
        const newSkill: Skill = { id: crypto.randomUUID(), ...data };
        setPrograms(p => p.map(prog => ({...prog, domains: addSkillRecursive(prog.domains, modal.domainId, newSkill) })));
    } else if (modal.type === 'editSkill') {
        const updatedSkill: Skill = { ...modal.skill, ...data };
        setPrograms(p => p.map(prog => ({ ...prog, domains: editSkillRecursive(prog.domains, modal.domainId, updatedSkill) })));
    }
    closeModal();
  };

  const handleDeleteSkill = () => {
      if (modal.type === 'deleteSkill') {
          onDeleteItems({ programIds: [], domainIds: [], skillIds: [modal.skill.id] });
          dropFromSelection([modal.skill.id]);
      }
      closeModal();
  };

  const handleDuplicateProgram = (programId: string) => {
      setPrograms(prev => {
          const program = prev.find(p => p.id === programId);
          if (!program) return prev;
          return [...prev, deepCloneProgramWithNewIds(program)];
      });
  };

  const handleToggleProgramEnabled = (programId: string) => {
      setPrograms(prev => prev.map(p => p.id === programId ? { ...p, enabled: p.enabled === false ? true : false } : p));
  };

  const handleImportClick = () => importFileRef.current?.click();
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const buffer = await file.arrayBuffer();
          const header = new Uint8Array(buffer, 0, 4);
          const isZip = header[0] === 0x50 && header[1] === 0x4B;

          let importedData: SchoolProgram[];
          let zip: JSZip | null = null;

          if (isZip) {
              zip = await JSZip.loadAsync(buffer);
              const dataFile = zip.file("data.json");
              if (!dataFile) throw new Error("data.json manquant dans l'archive");
              importedData = JSON.parse(await dataFile.async("string"));
          } else {
              importedData = JSON.parse(new TextDecoder().decode(buffer));
          }

          if (Array.isArray(importedData)) {
              // Structure complétée ; illustrations (chemin d'archive ou data URL) rangées dans le magasin d'images
              importedData = normalizePrograms(importedData);
              const restoreImages = async (domains: Domain[]) => {
                  for (const domain of domains) {
                      for (const skill of domain.skills) {
                          if (skill.image) skill.image = await importImageFromZip(zip, skill.image);
                      }
                      await restoreImages(domain.subDomains);
                  }
              };
              for (const prog of importedData) await restoreImages(prog.domains);
              onImportPrograms(importedData);
              toast.success(`${importedData.length} programme${importedData.length > 1 ? 's' : ''} importé${importedData.length > 1 ? 's' : ''}.`);
          }
          else toast.error("Format de fichier invalide.");
      } catch (error) { console.error("Erreur d'importation:", error); toast.error("Erreur de lecture du fichier."); }
      finally { if(e.target) e.target.value = ''; }
  };

  const selectedForExport = useMemo(() => {
    const filterRec = (ds: Domain[]): Domain[] => ds.reduce((acc, d) => {
            if (selectedIds.has(d.id)) {
                acc.push(d);
            } else {
                const skills = d.skills.filter(s => selectedIds.has(s.id));
                const subDomains = filterRec(d.subDomains || []);
                if (skills.length > 0 || subDomains.length > 0) {
                    acc.push({ ...d, skills, subDomains });
                }
            }
            return acc;
        }, [] as Domain[]);

    return programs.reduce((acc, p) => {
        if (selectedIds.has(p.id)) {
            acc.push(p);
        } else {
            const domains = filterRec(p.domains);
            if (domains.length > 0) {
                acc.push({ ...p, domains });
            }
        }
        return acc;
    }, [] as SchoolProgram[]);
  }, [selectedIds, programs]);

  const handleExport = async () => {
      const zip = new JSZip();
      const dataForExport: SchoolProgram[] = JSON.parse(JSON.stringify(selectedForExport));

      // Illustrations : octets copiés tels quels dans images/
      const extractImages = async (domains: Domain[]) => {
          for (const domain of domains) {
              for (const skill of domain.skills) {
                  if (skill.image) skill.image = await addImageToZip(zip, skill.image);
              }
              await extractImages(domain.subDomains ?? []);
          }
      };
      for (const prog of dataForExport) await extractImages(prog.domains);

      zip.file("data.json", JSON.stringify(dataForExport, null, 2));
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'programmes-competences.competences';
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Sélection exportée dans programmes-competences.competences.");
      closeModal();
  };

  // --- Moving Logic (Drag & Drop) ---
  const openMoveModal = (items: { id: string; type: 'skill' | 'domain' }[]) => {
      setModal({ type: 'move', items });
  };

  const handleMoveElements = (targetId: string, position: 'before' | 'after' | 'inside', draggedItems: { id: string; type: string }[] = []) => {
      const itemsToMove = draggedItems.length > 0 ? draggedItems : (modal.type === 'move' ? modal.items : []);
      // Tout est vérifié avant de toucher à l'arbre : un déplacement impossible ne perd rien.
      const result = moveTreeItems(programs, itemsToMove.map(i => i.id), targetId, position);
      if ('reason' in result) {
          toast.error(result.reason);
          return;
      }
      const moved = result.programs;
      setPrograms(() => moved);
      setSelectedIds(prev => {
         const next = new Set(prev);
         itemsToMove.forEach(i => next.delete(i.id));
         return next;
      });
      if (modal.type === 'move') closeModal();
  };

  /** Monter / Descendre un domaine ou une compétence dans sa liste (alternative clavier au glisser-déposer). */
  const moveBy = (id: string, delta: -1 | 1) => {
      const neighbor = neighborId(programs, id, delta);
      if (!neighbor) return;
      handleMoveElements(neighbor, delta < 0 ? 'before' : 'after', [{ id, type: 'item' }]);
  };

  /** Éléments à déplacer d'après la sélection effective (domaines entièrement cochés, compétences cochées). */
  const selectedMovableItems = (): { id: string; type: 'skill' | 'domain' }[] => {
      const sel = resolveSelection(programs, selectedIds);
      return [...sel.domainIds.map(id => ({ id, type: 'domain' as const })), ...sel.skillIds.map(id => ({ id, type: 'skill' as const }))];
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, item: { id: string, type: string }) => {
      e.stopPropagation();
      let itemsToDrag = [{ id: item.id, type: item.type }];

      if (selectedIds.has(item.id)) {
          const resolvedItems = selectedMovableItems();
          if (resolvedItems.length > 0) itemsToDrag = resolvedItems;
      }

      e.dataTransfer.setData('application/json', JSON.stringify(itemsToDrag));
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetType: 'program' | 'domain' | 'skill', dropPosition: DropPosition) => {
      e.preventDefault();
      e.stopPropagation();
      try {
          const data = e.dataTransfer.getData('application/json');
          const items = JSON.parse(data) as { id: string, type: string }[];

          // Dépôt sur soi-même : rien à faire
          if (items.some(i => i.id === targetId)) return;

          // Determine exact action (la validation complète est faite par moveTreeItems)
          let action: 'inside' | 'before' | 'after' = 'inside';

          if (dropPosition === 'top') action = 'before';
          else if (dropPosition === 'bottom') action = 'after';
          else if (dropPosition === 'inside') action = 'inside';
          else return; // Invalid position

          handleMoveElements(targetId, action, items);

      } catch (err) {
          console.error("Drop error", err);
      }
  };


  // --- Batch Delete Logic ---
  const handleBatchDeleteClick = () => {
      setModal({ type: 'batchDelete', selection: resolveSelection(programs, selectedIds) });
  };

  const handleConfirmBatchDelete = () => {
      if (modal.type === 'batchDelete') onDeleteItems(modal.selection);
      setSelectedIds(new Set());
      closeModal();
  };

  const handleBatchMoveClick = () => {
      const itemsToMove = selectedMovableItems();
      if (itemsToMove.length > 0) setModal({ type: 'move', items: itemsToMove });
  };


  const renderModal = () => {
    switch (modal.type) {
      case 'addProgram': return <TextInputModal title="Ajouter un programme" label="Nom du programme" onSave={handleAddProgram} onClose={closeModal} />;
      case 'editProgram': return <TextInputModal title="Modifier le programme" label="Nouveau nom" initialValue={modal.program.name} onSave={handleEditProgram} onClose={closeModal} />;
      case 'deleteProgram': return <ConfirmationModal title="Supprimer le programme" message={`Supprimer "${modal.program.name}" et tout son contenu ?`} onConfirm={handleDeleteProgram} onCancel={closeModal} />;
      case 'addDomain': return <DomainFormModal title={modal.isSubDomain ? "Ajouter un sous-domaine" : "Ajouter un domaine"} onSave={handleSaveDomain} onClose={closeModal} isSubDomain={modal.isSubDomain} />;
      case 'editDomain': return <DomainFormModal title={modal.isSubDomain ? "Modifier le sous-domaine" : "Modifier le domaine"} domainToEdit={modal.domain} onSave={handleSaveDomain} onClose={closeModal} isSubDomain={modal.isSubDomain} />;
      case 'deleteDomain': return <ConfirmationModal title="Supprimer le domaine" message={`Supprimer "${modal.domain.name}" et tout son contenu ?`} onConfirm={handleDeleteDomain} onCancel={closeModal} />;
      case 'addSkill': return <SkillFormModal title="Ajouter une compétence" onSave={handleSaveSkill} onClose={closeModal} />;
      case 'editSkill': return <SkillFormModal title="Modifier la compétence" skillToEdit={modal.skill} onSave={handleSaveSkill} onClose={closeModal} />;
      case 'deleteSkill': return <ConfirmationModal title="Supprimer la compétence" message={`Supprimer "${modal.skill.name}" ?`} onConfirm={handleDeleteSkill} onCancel={closeModal} />;
      case 'export': return <ExportProgramsModal programsToExport={selectedForExport} onExport={handleExport} onClose={closeModal} />;
      case 'move': return <MoveElementsModal programs={programs} itemsToMove={modal.items} onMove={(targetId) => handleMoveElements(targetId, 'inside', modal.items)} onClose={closeModal} />;
      case 'batchDelete': return <ConfirmationModal title="Suppression multiple" message={describeDeletion(modal.selection)} onConfirm={handleConfirmBatchDelete} onCancel={closeModal} confirmText="Supprimer tout" />;
      default: return null;
    }
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-white dark:bg-zinc-900">
        <div className="max-w-6xl mx-auto pb-20">
          <header className="mb-6">
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-zinc-200">Gestion des Compétences</h1>
                    {programs.length > 0 && ( <button onClick={handleToggleAllCollapse} className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"> {allCollapsibleIds.every(id => collapsedIds.has(id)) ? 'Tout déplier' : 'Tout replier'} </button> )}
                </div>
                <div className="flex items-center gap-2">
                    <Tooltip content="Importer" position="bottom-center">
                        <button onClick={handleImportClick} className="p-2 rounded-md text-slate-600 dark:text-zinc-300 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"><ImportIcon className="w-5 h-5" /></button>
                    </Tooltip>
                    <Tooltip content="Exporter" position="bottom-center">
                        <button onClick={() => setModal({ type: 'export' })} className="p-2 rounded-md text-slate-600 dark:text-zinc-300 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-50" disabled={selectedIds.size === 0}><ExportIcon className="w-5 h-5" /></button>
                    </Tooltip>
                    <button onClick={() => setModal({type: 'addProgram'})} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg flex items-center"><FolderPlusIcon className="w-5 h-5 mr-2" />Ajouter un programme</button>
                </div>
            </div>
            <p className="text-slate-500 dark:text-zinc-400">Gérez les programmes scolaires, domaines et compétences. Glissez-déposez pour réorganiser.</p>
          </header>

          <div className="mb-6 flex gap-4 items-center flex-wrap">
              <div className="flex-grow"><input type="search" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg"/></div>
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
              <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" className="h-5 w-5 rounded" ref={selectAllCheckboxRef} checked={allSelectionState === 'checked'} onChange={e => handleSelectAll(e.target.checked)} /><span className="text-sm font-medium text-slate-700 dark:text-zinc-300">Tout sélectionner</span></label>
          </div>

          <div className="space-y-6">
            {filteredPrograms.map(program => (
                <ProgramEditor
                    key={program.id}
                    program={program}
                    setModal={setModal}
                    collapsedIds={collapsedIds}
                    setCollapsedIds={setCollapsedIds}
                    selectedIds={selectedIds}
                    toggleSelection={toggleSelection}
                    isBatchModeActive={isBatchModeActive}
                    openMoveModal={openMoveModal} moveBy={moveBy}
                    onDrop={handleDrop}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDuplicate={() => handleDuplicateProgram(program.id)}
                    onToggleEnabled={() => handleToggleProgramEnabled(program.id)}
                    skillLayout={skillLayout}
                />
            ))}
          </div>
        </div>
      </div>
      {selectedIds.size > 0 && (
          <BatchSkillsActionBar
            count={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onDelete={handleBatchDeleteClick}
            onMove={handleBatchMoveClick}
          />
      )}
      <input type="file" ref={importFileRef} className="hidden" accept=".competences,.json" onChange={handleFileSelected} />
      {renderModal()}
    </>
  );
};

// --- Sub-components for editor structure ---

interface EditorProps {
    setModal: (m: ModalState) => void;
    collapsedIds: Set<string>;
    setCollapsedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedIds: Set<string>;
    toggleSelection: (id: string, children: string[]) => void;
    isBatchModeActive: boolean;
    openMoveModal: (items: any[]) => void;
    moveBy: (id: string, delta: -1 | 1) => void;
    onDragStart: (e: React.DragEvent, item: {id: string, type: string}) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, targetId: string, type: 'program' | 'domain' | 'skill', position: DropPosition) => void;
    skillLayout: 'rows' | 'columns';
}

const ProgramEditor: React.FC<EditorProps & { program: SchoolProgram; onDuplicate: () => void; onToggleEnabled: () => void }> =
({ program, setModal, collapsedIds, setCollapsedIds, selectedIds, toggleSelection, isBatchModeActive, openMoveModal, moveBy, onDrop, onDragOver, onDragStart, onDuplicate, onToggleEnabled, skillLayout }) => {
    const isDisabled = program.enabled === false;
    const isCollapsed = collapsedIds.has(program.id);
    const toggleCollapse = () => setCollapsedIds(p => { const n = new Set(p); if (n.has(program.id)) n.delete(program.id); else n.add(program.id); return n; });
    const childrenIds = useMemo(() => { const ids:string[] = []; const r = (d:Domain[]) => d.forEach(dom => { ids.push(dom.id); ids.push(...getDescendantIds(dom));}); r(program.domains); return ids; }, [program.domains]);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };
    const handleDragLeave = () => setIsDragOver(false);
    const handleDropLocal = (e: React.DragEvent) => {
        setIsDragOver(false);
        onDrop(e, program.id, 'program', 'inside');
    };

    return (
        <div
            className={`bg-slate-50 dark:bg-zinc-800/50 border rounded-xl transition-colors ${
                isDisabled
                    ? 'border-red-300 dark:border-red-700/50'
                    : isDragOver ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-slate-200 dark:border-zinc-700'
            }`}
            onDragOver={onDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDropLocal}
        >
            <header className={`group p-3 flex justify-between items-center rounded-t-xl ${isDisabled ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                <div className="flex items-center gap-2 flex-grow min-w-0">
                    <input type="checkbox" aria-label={`Sélectionner le programme ${program.name}`} checked={selectedIds.has(program.id)} onChange={() => toggleSelection(program.id, childrenIds)} className={`h-5 w-5 rounded transition-opacity ${isBatchModeActive || selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100'}`} />
                    <button onClick={toggleCollapse} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? 'Déplier' : 'Replier'} ${program.name}`} className="p-1 rounded-full"><ChevronIcon className={`w-5 h-5 ${isDisabled ? 'text-red-400 dark:text-red-500' : 'text-slate-500'}`} isCollapsed={isCollapsed} /></button>
                    <h2 className={`text-xl font-bold truncate select-none ${isDisabled ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-zinc-200'}`}>{program.name}</h2>
                    {isDisabled && <span className="flex-shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">Désactivé</span>}
                </div>
                <div className="flex items-center gap-1">
                    <Tooltip content="Dupliquer le programme" position="bottom-center">
                        <button onClick={onDuplicate} className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"><CopyIcon className="w-5 h-5"/></button>
                    </Tooltip>
                    <Tooltip content={isDisabled ? 'Activer le programme' : 'Désactiver le programme'} position="bottom-center">
                        <button
                            onClick={onToggleEnabled}
                            className={`p-2 ${isDisabled ? 'text-red-400 hover:text-green-600 dark:text-red-500 dark:hover:text-green-400' : 'text-slate-500 hover:text-orange-500 dark:hover:text-orange-400'}`}
                        >
                            {isDisabled ? <EyeIcon className="w-5 h-5"/> : <EyeSlashIcon className="w-5 h-5"/>}
                        </button>
                    </Tooltip>
                    <Tooltip content="Ajouter un domaine" position="bottom-center">
                        <button onClick={() => setModal({ type: 'addDomain', programId: program.id, isSubDomain: false })} className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"><PlusIcon className="w-5 h-5"/></button>
                    </Tooltip>
                    <Tooltip content="Modifier le programme" position="bottom-center">
                        <button onClick={() => setModal({ type: 'editProgram', program })} className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"><PencilIcon className="w-5 h-5"/></button>
                    </Tooltip>
                    <Tooltip content="Supprimer le programme" position="bottom-center">
                        <button onClick={() => setModal({ type: 'deleteProgram', program })} className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                    </Tooltip>
                </div>
            </header>
            {!isCollapsed && (
                <div className="p-4 space-y-4">
                    {(program.domains || []).map(domain => (
                        <DomainEditor
                            key={domain.id}
                            domain={domain}
                            level={0}
                            programId={program.id}
                            setModal={setModal}
                            collapsedIds={collapsedIds}
                            setCollapsedIds={setCollapsedIds}
                            selectedIds={selectedIds}
                            toggleSelection={toggleSelection}
                            isBatchModeActive={isBatchModeActive}
                            openMoveModal={openMoveModal} moveBy={moveBy}
                            onDrop={onDrop}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            skillLayout={skillLayout}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const DomainEditor: React.FC<EditorProps & { domain: Domain, level: number, programId: string }> =
({ domain, level, programId, setModal, collapsedIds, setCollapsedIds, selectedIds, toggleSelection, isBatchModeActive, openMoveModal, moveBy, onDrop, onDragOver, onDragStart, skillLayout }) => {
    const isCollapsed = collapsedIds.has(domain.id);
    const toggleCollapse = () => setCollapsedIds(p => { const n = new Set(p); if (n.has(domain.id)) n.delete(domain.id); else n.add(domain.id); return n; });
    const childrenIds = useMemo(() => getDescendantIds(domain), [domain]);
    const [areExpectationsCollapsed, setAreExpectationsCollapsed] = useState(true);

    const [dropPosition, setDropPosition] = useState<DropPosition>(null);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(null);
    };

    const handleLocalDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const h = rect.height;
        if (y < h * 0.1) setDropPosition('top');
        else if (y > h * 0.9) setDropPosition('bottom');
        else setDropPosition('inside');
    };

    const handleDropLocal = (e: React.DragEvent) => {
        setDropPosition(null);
        onDrop(e, domain.id, 'domain', dropPosition);
    };

    // Style based on dropPosition
    let borderClasses = 'border-slate-200 dark:border-zinc-700';
    let bgClasses = 'bg-white dark:bg-zinc-800';
    if (dropPosition === 'top') borderClasses = 'border-t-4 border-t-blue-500 border-slate-200 dark:border-zinc-700';
    if (dropPosition === 'bottom') borderClasses = 'border-b-4 border-b-blue-500 border-slate-200 dark:border-zinc-700';
    if (dropPosition === 'inside') { borderClasses = 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'; bgClasses = 'bg-blue-50 dark:bg-blue-900/20'; }


    return (
        <div
            className={`border rounded-lg transition-all ${borderClasses} ${bgClasses}`}
            onDragOver={handleLocalDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDropLocal}
        >
            <header
                className="group p-2 flex justify-between items-center cursor-grab active:cursor-grabbing"
                style={{ paddingLeft: `${0.5 + level * 1}rem`}}
                draggable
                onDragStart={(e) => onDragStart(e, { id: domain.id, type: 'domain' })}
            >
                <div className="flex items-center gap-2 flex-grow min-w-0 pointer-events-none">
                   {/* pointer-events-none on children ensures drag over fires on container more reliably for height calc */}
                    <div className="pointer-events-auto flex items-center gap-2 flex-grow min-w-0">
                        <input type="checkbox" aria-label={`Sélectionner ${domain.name}`} checked={selectedIds.has(domain.id)} onChange={() => toggleSelection(domain.id, childrenIds)} className={`h-5 w-5 rounded transition-opacity ${isBatchModeActive || selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100'}`} />
                        <button onClick={toggleCollapse} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? 'Déplier' : 'Replier'} ${domain.name}`} className="p-1 rounded-full"><ChevronIcon className="w-5 h-5 text-slate-500" isCollapsed={isCollapsed} /></button>
                        <h3 className="font-semibold text-slate-700 dark:text-zinc-200 truncate select-none">{domain.name}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity pointer-events-auto">
                    <Tooltip content="Ajouter une compétence" position="top-center">
                        <button onClick={() => setModal({ type: 'addSkill', domainId: domain.id })} className="p-2 text-slate-500 hover:text-blue-600"><PlusIcon className="w-4 h-4"/></button>
                    </Tooltip>
                    <Tooltip content="Ajouter un sous-domaine" position="top-center">
                        <button onClick={() => setModal({ type: 'addDomain', programId, parentDomainId: domain.id, isSubDomain: true })} className="p-2 text-slate-500 hover:text-blue-600"><FolderPlusIcon className="w-4 h-4"/></button>
                    </Tooltip>
                    <Tooltip content="Monter" position="top-center">
                        <button onClick={() => moveBy(domain.id, -1)} className="p-2 text-slate-500 hover:text-blue-600"><ArrowUpIcon className="w-4 h-4"/></button>
                    </Tooltip>
                    <Tooltip content="Descendre" position="top-center">
                        <button onClick={() => moveBy(domain.id, 1)} className="p-2 text-slate-500 hover:text-blue-600"><ArrowDownIcon className="w-4 h-4"/></button>
                    </Tooltip>
                    <Tooltip content="Modifier" position="top-center">
                        <button onClick={() => setModal({ type: 'editDomain', domain, isSubDomain: level > 0 })} className="p-2 text-slate-500 hover:text-blue-600"><PencilIcon className="w-4 h-4"/></button>
                    </Tooltip>
                    <Tooltip content="Supprimer" position="top-center">
                        <button onClick={() => setModal({ type: 'deleteDomain', domain })} className="p-2 text-slate-500 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button>
                    </Tooltip>
                </div>
            </header>
            {!isCollapsed && (
                <div className="pb-2 pointer-events-auto" style={{ paddingLeft: `${1.5 + level * 1}rem`, paddingRight: `0.5rem`}}>
                     {/* stopPropagation on inner content so dragging over children doesn't trigger parent drop logic incorrectly */}
                    {(domain.expectations || []).length > 0 && (
                        <div className="mb-2 bg-slate-50 dark:bg-zinc-700/50 rounded-md" onDragOver={e => e.stopPropagation()}>
                            <button
                                onClick={() => setAreExpectationsCollapsed(!areExpectationsCollapsed)}
                                className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-100 dark:hover:bg-zinc-600/50 rounded-md transition-colors"
                            >
                                <h4 className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Attendus en fin de maternelle</h4>
                                <ChevronIcon className="w-4 h-4 text-slate-500 dark:text-zinc-400" isCollapsed={areExpectationsCollapsed} />
                            </button>
                            {!areExpectationsCollapsed && (
                                <ul className="list-disc list-inside px-2 pb-2 text-sm text-slate-500 dark:text-zinc-400 space-y-1 border-t border-slate-200 dark:border-zinc-600 pt-2 mx-2">
                                    {(domain.expectations || []).map((exp, i) => <li key={i}>{exp}</li>)}
                                </ul>
                            )}
                        </div>
                    )}
                    {skillLayout === 'columns' ? (
                        <ul className="grid grid-cols-5 gap-1.5 py-2">
                            {(domain.skills || []).map(skill => (
                                <SkillItem
                                    key={skill.id}
                                    skill={skill}
                                    domainId={domain.id}
                                    setModal={setModal}
                                    selectedIds={selectedIds}
                                    toggleSelection={toggleSelection}
                                    isBatchModeActive={isBatchModeActive}
                                    openMoveModal={openMoveModal} moveBy={moveBy}
                                    onDragStart={onDragStart}
                                    onDragOver={onDragOver}
                                    onDrop={onDrop}
                                    layoutMode="columns"
                                />
                            ))}
                        </ul>
                    ) : (
                        <ul>
                            {(domain.skills || []).map(skill => (
                                <SkillItem
                                    key={skill.id}
                                    skill={skill}
                                    domainId={domain.id}
                                    setModal={setModal}
                                    selectedIds={selectedIds}
                                    toggleSelection={toggleSelection}
                                    isBatchModeActive={isBatchModeActive}
                                    openMoveModal={openMoveModal} moveBy={moveBy}
                                    onDragStart={onDragStart}
                                    onDragOver={onDragOver}
                                    onDrop={onDrop}
                                    layoutMode="rows"
                                />
                            ))}
                        </ul>
                    )}
                    <div className="mt-2 space-y-2">
                        {(domain.subDomains || []).map(sub => (
                            <DomainEditor
                                key={sub.id}
                                domain={sub}
                                level={level + 1}
                                programId={programId}
                                setModal={setModal}
                                collapsedIds={collapsedIds}
                                setCollapsedIds={setCollapsedIds}
                                selectedIds={selectedIds}
                                toggleSelection={toggleSelection}
                                isBatchModeActive={isBatchModeActive}
                                openMoveModal={openMoveModal} moveBy={moveBy}
                                onDragStart={onDragStart}
                                onDragOver={onDragOver}
                                onDrop={onDrop}
                                skillLayout={skillLayout}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SkillItem: React.FC<{
    skill: Skill,
    domainId: string,
    setModal: (m: ModalState) => void,
    selectedIds: Set<string>,
    toggleSelection: (id: string, children: string[]) => void,
    isBatchModeActive: boolean,
    openMoveModal: (items: any[]) => void,
    moveBy: (id: string, delta: -1 | 1) => void,
    onDragStart: (e: React.DragEvent, item: {id: string, type: string}) => void,
    onDragOver: (e: React.DragEvent) => void,
    onDrop: (e: React.DragEvent, targetId: string, type: 'program' | 'domain' | 'skill', position: DropPosition) => void;
    layoutMode: 'rows' | 'columns';
}> = ({ skill, domainId, setModal, selectedIds, toggleSelection, isBatchModeActive, openMoveModal, moveBy, onDragStart, onDragOver, onDrop, layoutMode }) => {
    const [dropPosition, setDropPosition] = useState<DropPosition>(null);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropPosition(null);
    };

    const handleLocalDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
            setDropPosition('top');
        } else {
            setDropPosition('bottom');
        }
    };

    const handleDropLocal = (e: React.DragEvent) => {
        setDropPosition(null);
        onDrop(e, skill.id, 'skill', dropPosition);
    };

    if (layoutMode === 'columns') {
        return (
            <li
                className={`group/skill relative rounded-md border p-1.5 flex flex-col gap-1 transition-all cursor-grab active:cursor-grabbing ${
                    selectedIds.has(skill.id) ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' :
                    dropPosition === 'top' ? 'bg-blue-50 dark:bg-blue-900/20 shadow-[inset_0_3px_0_0_#3b82f6] border-slate-200 dark:border-zinc-700' :
                    dropPosition === 'bottom' ? 'bg-blue-50 dark:bg-blue-900/20 shadow-[inset_0_-3px_0_0_#3b82f6] border-slate-200 dark:border-zinc-700' :
                    'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/50'
                }`}
                draggable
                onDragStart={(e) => onDragStart(e, { id: skill.id, type: 'skill' })}
                onDragOver={handleLocalDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDropLocal}
            >
                <input
                    type="checkbox"
                    aria-label={`Sélectionner ${skill.name}`}
                    checked={selectedIds.has(skill.id)}
                    onChange={() => toggleSelection(skill.id, [])}
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded transition-opacity ${isBatchModeActive || selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover/skill:opacity-100 group-focus-within/skill:opacity-100'}`}
                />
                {skill.image ? (
                    <StoredImage src={skill.image} alt="" className="w-8 h-8 object-cover rounded-md mx-auto flex-shrink-0" />
                ) : (
                    <div className="w-8 h-8 bg-slate-200 dark:bg-zinc-700 rounded-md mx-auto flex-shrink-0" />
                )}
                <span className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 leading-tight select-none text-center">{skill.name}</span>
                <div className="flex items-center justify-center gap-0.5">
                    {skill.referenceAges.map(age => (
                        <div key={age} className={`w-1.5 h-1.5 rounded-full ${REFERENCE_AGE_DOT_COLORS[age]}`} />
                    ))}
                </div>
                <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover/skill:opacity-100 group-focus-within/skill:opacity-100 transition-opacity">
                    <Tooltip content="Monter" position="top-center">
                        <button onClick={() => moveBy(skill.id, -1)} className="p-0.5 bg-white dark:bg-zinc-800 rounded shadow text-slate-400 hover:text-blue-600"><ArrowUpIcon className="w-3 h-3"/></button>
                    </Tooltip>
                    <Tooltip content="Descendre" position="top-center">
                        <button onClick={() => moveBy(skill.id, 1)} className="p-0.5 bg-white dark:bg-zinc-800 rounded shadow text-slate-400 hover:text-blue-600"><ArrowDownIcon className="w-3 h-3"/></button>
                    </Tooltip>
                    <Tooltip content="Modifier" position="top-center">
                        <button onClick={() => setModal({ type: 'editSkill', domainId, skill })} className="p-0.5 bg-white dark:bg-zinc-800 rounded shadow text-slate-400 hover:text-blue-600">
                            <PencilIcon className="w-3 h-3"/>
                        </button>
                    </Tooltip>
                    <Tooltip content="Supprimer" position="top-center">
                        <button onClick={() => setModal({ type: 'deleteSkill', domainId, skill })} className="p-0.5 bg-white dark:bg-zinc-800 rounded shadow text-slate-400 hover:text-red-600">
                            <TrashIcon className="w-3 h-3"/>
                        </button>
                    </Tooltip>
                </div>
            </li>
        );
    }

    // Visual feedback styles using shadows to avoid layout shifts
    let itemClasses = `group/skill relative flex justify-between items-center py-2 px-3 transition-all rounded-md`;

    if (dropPosition === 'top') {
        itemClasses += ` bg-blue-50 dark:bg-blue-900/20 shadow-[inset_0_3px_0_0_#3b82f6]`;
    } else if (dropPosition === 'bottom') {
        itemClasses += ` bg-blue-50 dark:bg-blue-900/20 shadow-[inset_0_-3px_0_0_#3b82f6]`;
    } else if (dropPosition === 'inside') {
        itemClasses += ` bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500`;
    } else {
        itemClasses += ` hover:bg-slate-50 dark:hover:bg-zinc-800/50`;
    }

    return (
        <li
            className={itemClasses}
            draggable
            onDragStart={(e) => onDragStart(e, { id: skill.id, type: 'skill' })}
            onDragOver={handleLocalDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDropLocal}
        >
            <div className="flex items-center gap-3 flex-grow min-w-0">
                <div className="flex items-center gap-3 flex-grow min-w-0">
                    <input type="checkbox" aria-label={`Sélectionner ${skill.name}`} checked={selectedIds.has(skill.id)} onChange={() => toggleSelection(skill.id, [])} className={`h-5 w-5 rounded transition-opacity ${isBatchModeActive || selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover/skill:opacity-100 group-focus-within/skill:opacity-100'}`} />
                    {skill.image ? (
                        <StoredImage src={skill.image} alt="" className="w-10 h-10 object-cover rounded-md flex-shrink-0 bg-slate-100" />
                    ) : (
                        <div className="w-10 h-10 bg-slate-200 dark:bg-zinc-700 rounded-md flex-shrink-0" />
                    )}
                    <div className="flex-grow min-w-0">
                        <div className="flex items-start gap-2">
                            <span className="text-slate-600 dark:text-zinc-300 truncate select-none cursor-grab active:cursor-grabbing">{skill.name}</span>
                            {skill.description && (
                                <div className="relative group/desc flex items-center">
                                    <button className="flex items-center" aria-label="Voir la description">
                                        <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 dark:text-zinc-500 cursor-pointer" />
                                    </button>
                                    <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-sm rounded-md shadow-lg opacity-0 group-hover/desc:opacity-100 group-focus-within/desc:opacity-100 transition-opacity duration-200 invisible group-hover/desc:visible group-focus-within/desc:visible z-20 pointer-events-none whitespace-normal break-words">
                                        {skill.description}
                                    </div>
                                </div>
                            )}
                        </div>
                        <Tooltip content={skill.referenceAges.join(', ')} position="bottom">
                            <div className="flex items-center gap-1.5 mt-1">
                                {skill.referenceAges.map(age => (
                                    <div key={age} className={`w-2 h-2 rounded-full ${REFERENCE_AGE_DOT_COLORS[age]}`} />
                                ))}
                            </div>
                        </Tooltip>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover/skill:opacity-100 group-focus-within/skill:opacity-100 transition-opacity">
                <Tooltip content="Monter" position="top-center">
                    <button onClick={() => moveBy(skill.id, -1)} className="p-2 text-slate-500 hover:text-blue-600"><ArrowUpIcon className="w-4 h-4"/></button>
                </Tooltip>
                <Tooltip content="Descendre" position="top-center">
                    <button onClick={() => moveBy(skill.id, 1)} className="p-2 text-slate-500 hover:text-blue-600"><ArrowDownIcon className="w-4 h-4"/></button>
                </Tooltip>
                <Tooltip content="Modifier" position="top-center">
                    <button onClick={() => setModal({ type: 'editSkill', domainId, skill })} className="p-2 text-slate-500 hover:text-blue-600"><PencilIcon className="w-4 h-4"/></button>
                </Tooltip>
                <Tooltip content="Supprimer" position="top-center">
                    <button onClick={() => setModal({ type: 'deleteSkill', domainId, skill })} className="p-2 text-slate-500 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button>
                </Tooltip>
            </div>
        </li>
    );
}

export default SkillsView;