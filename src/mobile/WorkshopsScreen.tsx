// Ateliers : passages en attente (mode élève) à valider ou refuser, et journal récent.
// Mêmes règles que sur ordinateur (domain/workshops.ts) : refuser un passage ne retire que ce qu'il avait validé.
import React, { useMemo, useState } from 'react';
import { Check, Shapes, X } from 'lucide-react';
import { formatDateFR, todayLocalISO } from '../../../domain/dates';
import { setEventsOutcome } from '../../../domain/workshops';
import StoredImage from '../../../images/StoredImage';
import type { AppData } from '../../../types';
import { groupBy, isSuccessfulPass, pendingPasses, processedPasses, studentName, type PassItem } from './model';
import type { ClassDocument } from './useClassDocument';
import { Avatar, Btn, EmptyState, Segmented, useSnack } from './ui';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (day: string) => (day === todayLocalISO() ? "Aujourd'hui" : formatDateFR(day, { weekday: 'long', day: 'numeric', month: 'long' }));

const WorkshopsScreen: React.FC<{ doc: ClassDocument }> = ({ doc }) => {
    const { data } = doc;
    const snack = useSnack();
    const [tab, setTab] = useState<'pending' | 'journal' | 'workshops'>('pending');
    const pending = useMemo(() => pendingPasses(data), [data.workshopEvents, data.students, data.workshops]);
    const journal = useMemo(() => processedPasses(data, 60), [data.workshopEvents, data.students, data.workshops]);

    const decide = (ids: string[], success: boolean) => {
        doc.update(d => setEventsOutcome(d, ids, success));
        const n = ids.length;
        snack(`${n} passage${n > 1 ? 's' : ''} ${success ? 'validé' : 'refusé'}${n > 1 ? 's' : ''}`, { kind: success ? 'success' : 'info', action: { label: 'Annuler', run: doc.undo } });
    };

    return (
        <div className="px-4 pt-4 pb-28 space-y-4">
            <Segmented<'pending' | 'journal' | 'workshops'> label="Affichage" value={tab} onChange={setTab}
                options={[{ id: 'pending', label: `À valider${pending.length ? ` (${pending.length})` : ''}` }, { id: 'journal', label: 'Journal' }, { id: 'workshops', label: 'Ateliers' }]} />

            {tab === 'pending' && (pending.length === 0 ? (
                <EmptyState title="Aucun passage en attente" icon={<Shapes className="w-12 h-12" />}>Les passages enregistrés en mode élève (QR codes) apparaissent ici.</EmptyState>
            ) : (
                <>
                    {pending.length > 1 && (
                        <div className="flex gap-2">
                            <Btn tone="success" block onClick={() => decide(pending.map(p => p.event.id), true)}><Check className="w-5 h-5" /> Tout valider ({pending.length})</Btn>
                        </div>
                    )}
                    {groupBy(pending, p => p.day).map(([day, items]) => (
                        <section key={day}>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400 mb-2">{dayLabel(day)}</h3>
                            <ul className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
                                {items.map(item => <PassRow key={item.event.id} item={item} onDecide={success => decide([item.event.id], success)} />)}
                            </ul>
                        </section>
                    ))}
                </>
            ))}

            {tab === 'journal' && (journal.length === 0 ? <EmptyState title="Journal vide" /> : (
                groupBy(journal, p => p.day).map(([day, items]) => (
                    <section key={day}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400 mb-2">{dayLabel(day)}</h3>
                        <ul className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
                            {items.map(item => <PassRow key={item.event.id} item={item} onDecide={success => decide([item.event.id], success)} journal />)}
                        </ul>
                    </section>
                ))
            ))}

            {tab === 'workshops' && <WorkshopList data={data} />}
        </div>
    );
};

const PassRow: React.FC<{ item: PassItem; onDecide: (success: boolean) => void; journal?: boolean }> = ({ item, onDecide, journal }) => {
    const ok = isSuccessfulPass(item.event);
    return (
        <li className="flex items-center gap-3 px-3 py-2.5">
            {item.student ? <Avatar student={item.student} size={40} /> : <span className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700" />}
            <span className="flex-1 min-w-0">
                <span className="block font-medium text-slate-900 dark:text-zinc-50 truncate">{item.student ? studentName(item.student) : 'Élève supprimé'}</span>
                <span className="block text-xs text-slate-500 dark:text-zinc-400 truncate">
                    {item.workshop?.name ?? 'Atelier supprimé'} · {time(item.event.timestamp)}
                    {journal && <> · <strong className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{ok ? 'validé' : 'refusé'}</strong></>}
                </span>
            </span>
            {(!journal || !ok) && (
                <button type="button" aria-label="Valider" onClick={() => onDecide(true)} className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 inline-flex items-center justify-center"><Check className="w-5 h-5" strokeWidth={3} /></button>
            )}
            {(!journal || ok) && (
                <button type="button" aria-label="Refuser" onClick={() => onDecide(false)} className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 inline-flex items-center justify-center"><X className="w-5 h-5" strokeWidth={3} /></button>
            )}
        </li>
    );
};

const WorkshopList: React.FC<{ data: AppData }> = ({ data }) => {
    const skillNames = useMemo(() => {
        const names = new Map<string, string>();
        const walk = (d: { skills: { id: string; name: string }[]; subDomains?: unknown[] }) => { d.skills.forEach(s => names.set(s.id, s.name)); (d.subDomains as typeof d[] ?? []).forEach(walk); };
        data.schoolPrograms.forEach(p => p.domains.forEach(walk));
        return names;
    }, [data.schoolPrograms]);
    const workshops = [...data.workshops].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'fr'));
    if (workshops.length === 0) return <EmptyState title="Aucun atelier">Les ateliers se créent dans l'interface ordinateur.</EmptyState>;
    return (
        <ul className="space-y-3">
            {workshops.map(w => (
                <li key={w.id} className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-sm p-4 ${w.isActive ? '' : 'opacity-60'}`}>
                    <div className="flex gap-3">
                        {w.image && <StoredImage src={w.image} alt="" className="w-14 h-14 rounded-xl object-cover" />}
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-zinc-50">{w.name}{!w.isActive && <span className="ml-2 text-xs font-normal">(inactif)</span>}</p>
                            {w.description && <p className="text-sm text-slate-600 dark:text-zinc-300">{w.description}</p>}
                        </div>
                    </div>
                    {w.skillIds.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 dark:text-zinc-300 space-y-0.5">
                            {w.skillIds.map(id => <li key={id}>{skillNames.get(id) ?? 'Compétence supprimée'}</li>)}
                        </ul>
                    )}
                </li>
            ))}
        </ul>
    );
};

export default WorkshopsScreen;
