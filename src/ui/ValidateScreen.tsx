// Validation groupée : une ou plusieurs compétences, pour plusieurs élèves, à une date.
// Même règle que sur ordinateur : une compétence déjà acquise est conservée telle quelle.
import React, { useMemo, useState } from 'react';
import { Check, ListChecks, X } from 'lucide-react';
import { isAcquired } from '../../core/domain/acquisitions';
import { todayLocalISO } from '../../core/domain/dates';
import { applyMassValidation } from '../../core/domain/students';
import { sectionOrder } from '../../core/utils';
import type { AppData } from '../../core/types';
import { activePrograms, flattenSkills, matchesQuery, shortNames, sortStudents, studentName, type FlatSkill } from './model';
import type { ClassDocument } from './useClassDocument';
import { Avatar, Btn, Chip, EmptyState, Field, inputClass, SearchInput, Sheet, useSnack } from './ui';

const ValidateScreen: React.FC<{ doc: ClassDocument }> = ({ doc }) => {
    const { data } = doc;
    const snack = useSnack();
    const [skillIds, setSkillIds] = useState<string[]>([]);
    const [studentIds, setStudentIds] = useState<Set<string>>(new Set());
    const [date, setDate] = useState(todayLocalISO());
    const [picking, setPicking] = useState(false);

    const flat = useMemo(() => flattenSkills(activePrograms(data)), [data.schoolPrograms]);
    const byId = useMemo(() => new Map(flat.map(f => [f.skill.id, f])), [flat]);
    const selectedSkills = skillIds.map(id => byId.get(id)).filter((f): f is FlatSkill => !!f);
    const students = useMemo(() => sortStudents(data.students), [data.students]);
    const names = useMemo(() => shortNames(data.students), [data.students]);
    const sections = sectionOrder.filter(s => students.some(st => st.section === s));

    const allAcquired = (studentId: string) => {
        const s = data.students.find(x => x.id === studentId);
        return !!s && selectedSkills.length > 0 && selectedSkills.every(f => isAcquired(s.skills[f.skill.id]));
    };
    const targets = [...studentIds].filter(id => !allAcquired(id));

    const toggleStudent = (id: string) => setStudentIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const validate = () => {
        const result = applyMassValidation(data, { studentIds: targets, skillIds: selectedSkills.map(f => f.skill.id), date, getPhoto: () => null });
        doc.update(() => result.data);
        snack(`${result.granted} validation${result.granted > 1 ? 's' : ''} enregistrée${result.granted > 1 ? 's' : ''}${result.kept ? ` (${result.kept} déjà acquise${result.kept > 1 ? 's' : ''}, conservée${result.kept > 1 ? 's' : ''})` : ''}`,
            { kind: 'success', action: { label: 'Annuler', run: doc.undo } });
        setStudentIds(new Set());
    };

    if (flat.length === 0 || students.length === 0) {
        return <EmptyState title="Rien à valider pour l'instant" icon={<ListChecks className="w-12 h-12" />}>Il faut au moins un élève et un programme de compétences.</EmptyState>;
    }

    return (
        <div className="px-4 sm:px-6 pt-4 space-y-5 max-w-6xl">
            <section className="space-y-2">
                <h2 className="font-semibold text-slate-900 dark:text-zinc-50">1. Compétences</h2>
                {selectedSkills.length > 0 && (
                    <ul className="space-y-2">
                        {selectedSkills.map(f => (
                            <li key={f.skill.id} className="flex items-start gap-2 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 shadow-sm">
                                <span className="flex-1 min-w-0 text-sm"><span className="block text-xs text-slate-500 dark:text-zinc-400 truncate">{f.path.join(' › ')}</span>{f.skill.name}</span>
                                <button type="button" aria-label={`Retirer ${f.skill.name}`} className="w-11 h-11 -my-1 inline-flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800" onClick={() => setSkillIds(ids => ids.filter(id => id !== f.skill.id))}><X className="w-4 h-4" /></button>
                            </li>
                        ))}
                    </ul>
                )}
                <Btn block onClick={() => setPicking(true)}>{selectedSkills.length ? 'Modifier les compétences' : 'Choisir les compétences'}</Btn>
            </section>

            <section className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900 dark:text-zinc-50">2. Élèves</h2>
                    <span className="text-sm text-slate-500 dark:text-zinc-400">{studentIds.size} sélectionné{studentIds.size > 1 ? 's' : ''}</span>
                </div>
                <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                    <Chip onClick={() => setStudentIds(new Set(students.map(s => s.id)))}>Tous</Chip>
                    {sections.length > 1 && sections.map(sec => (
                        <Chip key={sec} onClick={() => setStudentIds(new Set(students.filter(s => s.section === sec).map(s => s.id)))}>{sec}</Chip>
                    ))}
                    <Chip onClick={() => setStudentIds(new Set())}>Aucun</Chip>
                </div>
                <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                    {students.map(s => {
                        const selected = studentIds.has(s.id);
                        const done = allAcquired(s.id);
                        return (
                            <li key={s.id}>
                                <button type="button" onClick={() => toggleStudent(s.id)} aria-pressed={selected}
                                    className={`relative w-full flex flex-col items-center gap-1 p-2 rounded-xl border-2 ${selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-transparent bg-white dark:bg-zinc-900'} ${done ? 'opacity-50' : ''}`}>
                                    <Avatar student={s} size={48} />
                                    <span className="text-xs font-medium text-center leading-tight text-slate-800 dark:text-zinc-100 line-clamp-2">{names.get(s.id)}</span>
                                    {selected && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>}
                                    <span className={`text-[11px] leading-4 h-4 text-emerald-700 dark:text-emerald-400 ${done ? '' : 'invisible'}`}>déjà acquis</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section>
                <Field label="3. Date"><input type="date" className={inputClass} value={date} max={todayLocalISO()} onChange={e => setDate(e.target.value)} /></Field>
            </section>

            <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 bg-slate-100/95 dark:bg-zinc-950/95 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                <Btn tone="success" block disabled={!selectedSkills.length || !targets.length || !date} onClick={validate}>
                    <Check className="w-5 h-5" /> Valider{targets.length ? ` pour ${targets.length} élève${targets.length > 1 ? 's' : ''}` : ''}
                </Btn>
            </div>

            {picking && <SkillPicker data={data} flat={flat} selected={skillIds} onClose={ids => { setSkillIds(ids); setPicking(false); }} />}
        </div>
    );
};

const SkillPicker: React.FC<{ data: AppData; flat: FlatSkill[]; selected: string[]; onClose: (ids: string[]) => void }> = ({ flat, selected, onClose }) => {
    const [query, setQuery] = useState('');
    const [ids, setIds] = useState<string[]>(selected);
    const shown = flat.filter(f => matchesQuery(query, f.skill.name, f.skill.description, ...f.path)).slice(0, 300);
    const groups: [string, FlatSkill[]][] = [];
    for (const f of shown) {
        const key = f.path.join(' › ');
        const last = groups[groups.length - 1];
        if (last && last[0] === key) last[1].push(f); else groups.push([key, [f]]);
    }
    const toggle = (id: string) => setIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    return (
        <Sheet title="Compétences à valider" full onClose={() => onClose(ids)}
            footer={<Btn tone="primary" block onClick={() => onClose(ids)}>Terminé ({ids.length})</Btn>}>
            <div className="sticky top-0 bg-white dark:bg-zinc-900 pb-2 z-10"><SearchInput value={query} onChange={setQuery} placeholder="Rechercher (mots du nom ou du domaine)" /></div>
            {groups.length === 0 ? <EmptyState title="Aucune compétence ne correspond" /> : groups.map(([path, items]) => (
                <div key={path} className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{path}</p>
                    <ul>
                        {items.map(f => (
                            <li key={f.skill.id}>
                                <label className="flex items-start gap-3 py-2.5 min-h-12">
                                    <input type="checkbox" className="mt-0.5" checked={ids.includes(f.skill.id)} onChange={() => toggle(f.skill.id)} />
                                    <span className="text-[15px] leading-snug text-slate-800 dark:text-zinc-100">{f.skill.name}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </Sheet>
    );
};

export default ValidateScreen;
