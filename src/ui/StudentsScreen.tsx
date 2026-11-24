// Liste des élèves de la classe.
import React, { useMemo, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { calculateAge, sectionOrder } from '../../core/utils';
import type { AppData, Section } from '../../core/types';
import { activePrograms, countAcquired, flattenSkills, matchesQuery, sortStudents, studentName } from './model';
import { Avatar, Btn, Chip, EmptyState, ProgressBar, SearchInput } from './ui';

interface Props {
    data: AppData;
    selectedId: string | null;
    onOpenStudent: (id: string) => void;
    onAddStudent: () => void;
}

const StudentsScreen: React.FC<Props> = ({ data, selectedId, onOpenStudent, onAddStudent }) => {
    const [query, setQuery] = useState('');
    const [section, setSection] = useState<Section | 'all'>('all');
    const skillIds = useMemo(() => flattenSkills(activePrograms(data)).map(f => f.skill.id), [data.schoolPrograms]);
    const sections = useMemo(() => sectionOrder.filter(s => data.students.some(st => st.section === s)), [data.students]);
    const students = useMemo(() => sortStudents(data.students).filter(s =>
        (section === 'all' || s.section === section) && matchesQuery(query, s.firstName, s.lastName)), [data.students, section, query]);

    if (data.students.length === 0) {
        return (
            <EmptyState title="Aucun élève dans cette classe" icon={<Users className="w-12 h-12" />}>
                <p>Ajoutez vos élèves ici, ou ouvrez une classe préparée avec l'application pour ordinateur.</p>
                <Btn tone="primary" className="mt-4" onClick={onAddStudent}>Ajouter un élève</Btn>
            </EmptyState>
        );
    }

    return (
        <div className="pb-8">
            <div className="px-4 pt-3 pb-3 space-y-3 bg-slate-100/95 dark:bg-zinc-950/95 backdrop-blur sticky z-10" style={{ top: 'calc(4rem + env(safe-area-inset-top))' }}>
                <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un élève" />
                {sections.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                        <Chip active={section === 'all'} onClick={() => setSection('all')}>Tous ({data.students.length})</Chip>
                        {sections.map(s => (
                            <Chip key={s} active={section === s} onClick={() => setSection(s)}>{s} ({data.students.filter(st => st.section === s).length})</Chip>
                        ))}
                    </div>
                )}
            </div>
            {students.length === 0 ? <EmptyState title="Aucun élève ne correspond" /> : (
                <ul className="mx-4 bg-white dark:bg-zinc-900 rounded-2xl divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden shadow-sm">
                    {students.map(s => {
                        const acquired = countAcquired(s, skillIds);
                        const age = calculateAge(s.dob);
                        const selected = s.id === selectedId;
                        return (
                            <li key={s.id}>
                                <button type="button" onClick={() => onOpenStudent(s.id)} aria-current={selected ? 'true' : undefined}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${selected ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 active:bg-slate-100 dark:active:bg-zinc-800'}`}>
                                    <Avatar student={s} size={48} />
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-semibold text-slate-900 dark:text-zinc-50 truncate">{studentName(s)}</span>
                                        <span className="block text-xs text-slate-500 dark:text-zinc-400">{s.section}{age ? ` · ${age} an${age > 1 ? 's' : ''}` : ''} · {acquired}/{skillIds.length} compétences</span>
                                        <span className="block mt-1.5"><ProgressBar value={acquired} total={skillIds.length} label={`Progression de ${studentName(s)}`} /></span>
                                    </span>
                                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-zinc-600" aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default StudentsScreen;
