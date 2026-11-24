// Fiche d'un élève : compétences par domaine, validation en un geste, photo de preuve.
import React, { useMemo, useState } from 'react';
import { Camera, Check, ChevronDown, ImagePlus, Pencil } from 'lucide-react';
import { grantSkills, isAcquired } from '../../app/domain/acquisitions';
import { formatDateFR, todayLocalISO } from '../../app/domain/dates';
import { setSkillDetails } from '../../app/domain/students';
import StoredImage from '../../app/images/StoredImage';
import { calculateAge, sectionOrder } from '../../app/utils';
import { Proficiency, type AppData, type Domain, type Section, type Skill, type SkillAcquisitionDetails, type Student } from '../../app/types';
import { activePrograms, countAcquired, domainSkillIds, flattenSkills, matchesQuery, studentName } from './model';
import { pickPhoto } from './photos';
import type { ClassDocument } from './useClassDocument';
import { Avatar, Btn, EmptyState, Field, IconButton, inputClass, ProgressBar, SearchInput, Segmented, Sheet, TopBar, useSnack } from './ui';

type Filter = 'todo' | 'acquired' | 'all';

interface Props {
    doc: ClassDocument;
    student: Student;
    onBack: () => void;
    onEdit: () => void;
}

const StudentScreen: React.FC<Props> = ({ doc, student, onBack, onEdit }) => {
    const { data } = doc;
    const snack = useSnack();
    const [filter, setFilter] = useState<Filter>('todo');
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState<Set<string>>(new Set());
    const [sheetSkill, setSheetSkill] = useState<{ skill: Skill; path: string[] } | null>(null);

    const programs = useMemo(() => activePrograms(data), [data.schoolPrograms]);
    const allSkills = useMemo(() => flattenSkills(programs), [programs]);
    const acquired = countAcquired(student, allSkills.map(f => f.skill.id));
    const age = calculateAge(student.dob);
    const searching = query.trim().length > 0;

    const visible = (skill: Skill) => {
        const done = isAcquired(student.skills[skill.id]);
        if (filter === 'todo' && done) return false;
        if (filter === 'acquired' && !done) return false;
        return matchesQuery(query, skill.name, skill.description);
    };

    const quickValidate = (skill: Skill) => {
        const date = todayLocalISO();
        doc.update(d => {
            const current = d.students.find(s => s.id === student.id);
            return current ? setSkillDetails(d, current.id, grantSkills(current.skills, [skill.id], { date, section: current.section }).skills) : d;
        });
        snack(`« ${skill.name} » validée pour ${student.firstName}`, { kind: 'success', action: { label: 'Annuler', run: doc.undo } });
    };

    const toggle = (id: string) => setOpen(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const renderSkills = (domain: Domain, path: string[]): React.ReactNode => {
        const here = [...path, domain.name];
        const skills = domain.skills.filter(visible);
        const subs = (domain.subDomains ?? []).map(sub => ({ sub, node: renderSkills(sub, here) })).filter(x => x.node);
        if (skills.length === 0 && subs.length === 0) return null;
        return (
            <>
                {skills.map(skill => {
                    const details = student.skills[skill.id];
                    const done = isAcquired(details);
                    return (
                        <li key={skill.id} className="flex items-stretch border-t border-slate-100 dark:border-zinc-800 first:border-t-0">
                            <button type="button" onClick={() => (done ? setSheetSkill({ skill, path: here }) : quickValidate(skill))}
                                aria-label={done ? `${skill.name} : acquise (détails)` : `Valider ${skill.name}`}
                                className="pl-4 pr-2 flex items-center">
                                <span className={`w-8 h-8 rounded-full border-2 inline-flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-zinc-600 text-transparent'}`}>
                                    <Check className="w-5 h-5" strokeWidth={3} />
                                </span>
                            </button>
                            <button type="button" onClick={() => setSheetSkill({ skill, path: here })} className="flex-1 min-w-0 text-left py-3 pr-4 active:bg-slate-50 dark:active:bg-zinc-800">
                                <span className="block text-[15px] leading-snug text-slate-800 dark:text-zinc-100">{skill.name}</span>
                                {(done || skill.referenceAges.length > 0) && (
                                    <span className="block text-xs mt-0.5 text-slate-500 dark:text-zinc-400">
                                        {done ? `Acquise le ${formatDateFR(details.date)}${details.section ? ` (${details.section})` : ''}${details.photo ? ' · photo' : ''}` : skill.referenceAges.join(' · ')}
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
                {subs.map(({ sub, node }) => (
                    <li key={sub.id} className="border-t border-slate-100 dark:border-zinc-800">
                        <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{sub.name}</p>
                        <ul>{node}</ul>
                    </li>
                ))}
            </>
        );
    };

    const domainCards = programs.flatMap(program => program.domains.map(domain => {
        const ids = domainSkillIds(domain);
        const content = renderSkills(domain, []);
        if (!content && searching) return null; // recherche : seuls les domaines concernés
        const isOpen = searching || open.has(domain.id);
        const count = countAcquired(student, ids);
        return (
            <section key={`${program.id}/${domain.id}`} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm overflow-hidden">
                <button type="button" onClick={() => toggle(domain.id)} aria-expanded={isOpen} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                    <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-slate-900 dark:text-zinc-50 leading-snug">{domain.name}</span>
                        <span className="flex items-center gap-2 mt-1.5">
                            <span className="flex-1"><ProgressBar value={count} total={ids.length} /></span>
                            <span className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">{count}/{ids.length}</span>
                        </span>
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (content
                    ? <ul className="border-t border-slate-100 dark:border-zinc-800">{content}</ul>
                    : <p className="px-4 py-3 text-sm text-slate-500 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800">{filter === 'todo' ? 'Tout est acquis dans ce domaine.' : 'Aucune compétence acquise dans ce domaine.'}</p>)}
            </section>
        );
    })).filter(Boolean);

    return (
        <div className="min-h-full pb-24">
            <TopBar title={studentName(student)} subtitle={`${student.section}${age ? ` · ${age} an${age > 1 ? 's' : ''}` : ''}`} onBack={onBack}
                actions={<IconButton label="Modifier la fiche" onClick={onEdit}><Pencil className="w-5 h-5" /></IconButton>} />
            <div className="px-4 pt-4 space-y-4">
                <div className="flex items-center gap-4">
                    <Avatar student={student} size={64} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600 dark:text-zinc-300"><strong className="text-slate-900 dark:text-zinc-50 text-lg">{acquired}</strong> compétence{acquired > 1 ? 's' : ''} acquise{acquired > 1 ? 's' : ''} sur {allSkills.length}</p>
                        <div className="mt-2"><ProgressBar value={acquired} total={allSkills.length} label="Progression" /></div>
                    </div>
                </div>
                <Segmented<Filter> label="Afficher" value={filter} onChange={setFilter}
                    options={[{ id: 'todo', label: 'À valider' }, { id: 'acquired', label: 'Acquises' }, { id: 'all', label: 'Toutes' }]} />
                <SearchInput value={query} onChange={setQuery} placeholder="Rechercher une compétence" />
                {programs.length === 0 ? (
                    <EmptyState title="Aucun programme dans cette classe">Importez un programme (.competences) depuis l'onglet « Plus ».</EmptyState>
                ) : domainCards.length === 0 ? (
                    <EmptyState title="Aucune compétence ne correspond" />
                ) : (
                    <div className="space-y-3">{domainCards}</div>
                )}
                {filter === 'todo' && !searching && programs.length > 0 && (
                    <p className="text-xs text-center text-slate-400 dark:text-zinc-500 pb-2">Touchez le rond pour valider aujourd'hui, le texte pour choisir une date ou ajouter une photo.</p>
                )}
            </div>
            {sheetSkill && (
                <SkillSheet doc={doc} student={student} skill={sheetSkill.skill} path={sheetSkill.path} onClose={() => setSheetSkill(null)} />
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------------------------

const SkillSheet: React.FC<{ doc: ClassDocument; student: Student; skill: Skill; path: string[]; onClose: () => void }> = ({ doc, student, skill, path, onClose }) => {
    const snack = useSnack();
    const details = student.skills[skill.id];
    const done = isAcquired(details);
    const [date, setDate] = useState(details?.date ?? todayLocalISO());
    const [section, setSection] = useState<Section>(details?.section ?? student.section);
    const [photo, setPhoto] = useState<string | null>(details?.photo ?? null);
    const [busy, setBusy] = useState(false);

    const addPhoto = async (camera: boolean) => {
        setBusy(true);
        try {
            const ref = await pickPhoto(camera);
            if (ref) setPhoto(ref);
        } finally {
            setBusy(false);
        }
    };

    const save = () => {
        const next: SkillAcquisitionDetails = { proficiency: Proficiency.Acquired, date, section, ...(photo ? { photo } : {}) };
        doc.update(d => setSkillDetails(d, student.id, { [skill.id]: next }));
        snack(done ? 'Validation modifiée' : `« ${skill.name} » validée pour ${student.firstName}`, { kind: 'success', action: { label: 'Annuler', run: doc.undo } });
        onClose();
    };

    const remove = () => {
        doc.update(d => setSkillDetails(d, student.id, { [skill.id]: { proficiency: Proficiency.NotAcquired } }));
        snack('Validation retirée', { action: { label: 'Annuler', run: doc.undo } });
        onClose();
    };

    return (
        <Sheet title={done ? 'Compétence acquise' : 'Valider la compétence'} onClose={onClose}
            footer={
                <div className="flex gap-2">
                    {done && <Btn tone="danger" onClick={remove}>Retirer</Btn>}
                    <Btn tone="primary" block disabled={busy || !date} onClick={save}>{done ? 'Enregistrer' : 'Valider'}</Btn>
                </div>
            }>
            <div className="space-y-4">
                <div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{path.join(' › ')}</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-zinc-50 leading-snug">{skill.name}</p>
                    {skill.referenceAges.length > 0 && <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Repère : {skill.referenceAges.join(' · ')}</p>}
                    {skill.description && <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300 whitespace-pre-line">{skill.description}</p>}
                    {skill.image && <StoredImage src={skill.image} alt="" className="mt-3 max-h-40 rounded-xl" />}
                </div>
                <p className="text-sm text-slate-600 dark:text-zinc-300">Élève : <strong>{studentName(student)}</strong></p>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Date"><input type="date" className={inputClass} value={date} max={todayLocalISO()} onChange={e => setDate(e.target.value)} /></Field>
                    <Field label="Section">
                        <select className={inputClass} value={section} onChange={e => setSection(e.target.value as Section)}>
                            {sectionOrder.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </Field>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Photo de preuve (facultative)</p>
                    {photo && (
                        <div className="relative mb-2">
                            <StoredImage src={photo} alt="Photo de preuve" className="w-full max-h-64 object-contain rounded-xl bg-slate-100 dark:bg-zinc-800" />
                            <Btn className="absolute top-2 right-2 !min-h-9 !px-3 text-sm" onClick={() => setPhoto(null)}>Retirer</Btn>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Btn block disabled={busy} onClick={() => addPhoto(true)}><Camera className="w-5 h-5" /> Prendre</Btn>
                        <Btn block disabled={busy} onClick={() => addPhoto(false)}><ImagePlus className="w-5 h-5" /> Choisir</Btn>
                    </div>
                </div>
            </div>
        </Sheet>
    );
};

export default StudentScreen;
