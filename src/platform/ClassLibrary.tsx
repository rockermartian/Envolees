// Liste des classes enregistrées dans ce navigateur (boîte « Ouvrir » de l'interface ordinateur,
// écran d'accueil de l'interface mobile).
import React, { useCallback, useEffect, useState } from 'react';
import { askName, Button, confirmAction, showMessage } from './dialogs';
import { exportClassFile, formatBytes, formatDateTime } from './exporting';
import { canLinkFiles } from './fileAccess';
import { deleteClass, listClasses, storageInfo, updateClassMeta, type ClassSummary } from './library';

interface Props {
    onOpen: (id: string) => void;
    onImport: () => void;
    /** Classe ouverte dans cet onglet (ni suppression, ni renommage depuis la liste). */
    currentId?: string | null;
    busy?: boolean;
}

const exportMessage = (outcome: string) =>
    outcome === 'downloaded' ? 'Fichier téléchargé (dossier Téléchargements).' : outcome === 'saved' ? 'Fichier enregistré.' : outcome === 'shared' ? 'Fichier partagé.' : '';

// Partage de fichiers (téléphone, tablette) : Fichiers, Drive, e-mail…
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const ClassLibrary: React.FC<Props> = ({ onOpen, onImport, currentId, busy }) => {
    const [classes, setClasses] = useState<ClassSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [storage, setStorage] = useState<string | null>(null);
    const [menuFor, setMenuFor] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setClasses(await listClasses());
            const info = await storageInfo();
            if (info) setStorage(`${formatBytes(info.usage)} utilisés${info.persisted ? ' · stockage protégé' : ''}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);

    const run = async (work: () => Promise<unknown>) => {
        setMenuFor(null);
        try { await work(); } catch (e) { await showMessage('Opération impossible', e instanceof Error ? e.message : String(e)); }
        await refresh();
    };

    const exportOne = (c: ClassSummary, how: 'auto' | 'download' | 'share') => run(async () => {
        const outcome = await exportClassFile(c.id, how);
        const msg = exportMessage(outcome);
        if (msg) await showMessage('Exportation', msg);
    });

    const rename = (c: ClassSummary) => run(async () => {
        const result = await askName('Renommer la classe', 'Nom de la classe', c.name, 'Renommer');
        if (result) await updateClassMeta(c.id, { name: result.name });
    });

    const remove = (c: ClassSummary) => run(async () => {
        const ok = await confirmAction('Supprimer la classe',
            `« ${c.name} » sera supprimée de ce navigateur, avec ses copies de sécurité.\n\n${c.exportedAt ? `Dernier fichier exporté : ${formatDateTime(c.exportedAt)}.` : "Cette classe n'a jamais été exportée en fichier .envolees."}`,
            'Supprimer', true);
        if (ok) await deleteClass(c.id);
    });

    if (error) return <p className="text-red-600 dark:text-red-400">{error}</p>;

    return (
        <div className="space-y-3">
            {classes === null ? (
                <p className="text-slate-500 dark:text-zinc-400">Chargement…</p>
            ) : classes.length === 0 ? (
                <p className="text-slate-500 dark:text-zinc-400 py-2">Aucune classe dans ce navigateur pour l'instant. Ouvrez un fichier <strong>.envolees</strong> (créé sur ordinateur ou exporté depuis un autre appareil) ou créez une nouvelle classe.</p>
            ) : (
                <ul className="divide-y divide-slate-200 dark:divide-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                    {classes.map(c => (
                        <li key={c.id} className="relative bg-white dark:bg-zinc-800">
                            <div className="flex items-stretch">
                                <button type="button" disabled={busy} onClick={() => onOpen(c.id)} data-class-id={c.id}
                                    className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-700/60 disabled:opacity-60">
                                    <span className="block font-semibold truncate">{c.name}{c.id === currentId && <span className="ml-2 text-xs font-medium text-indigo-600 dark:text-indigo-300">(ouverte)</span>}</span>
                                    <span className="block text-sm text-slate-500 dark:text-zinc-400">
                                        {c.studentCount ?? 0} élève{(c.studentCount ?? 0) > 1 ? 's' : ''} · {c.imageCount} image{c.imageCount > 1 ? 's' : ''} · modifiée {formatDateTime(c.updatedAt)}
                                    </span>
                                    <span className="block text-xs mt-0.5 text-slate-400 dark:text-zinc-500">
                                        {c.handle ? `Fichier lié : ${c.handle.name}` : c.exportedAt ? `Exportée ${formatDateTime(c.exportedAt)}` : 'Jamais exportée en fichier'}
                                    </span>
                                </button>
                                <button type="button" aria-label={`Actions pour ${c.name}`} aria-expanded={menuFor === c.id} onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                                    className="px-4 text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-700/60">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                                </button>
                            </div>
                            {menuFor === c.id && (
                                <div className="flex flex-wrap gap-2 px-4 pb-3">
                                    {canLinkFiles() && <Button onClick={() => exportOne(c, 'auto')}>Enregistrer une copie…</Button>}
                                    {!canLinkFiles() && canShare && <Button onClick={() => exportOne(c, 'share')}>Partager…</Button>}
                                    {!canLinkFiles() && <Button onClick={() => exportOne(c, 'download')}>Télécharger</Button>}
                                    {c.id !== currentId && <Button onClick={() => rename(c)}>Renommer</Button>}
                                    {c.id !== currentId && <Button kind="danger" onClick={() => remove(c)}>Supprimer</Button>}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <Button kind="ghost" className="w-full border border-dashed border-indigo-300 dark:border-zinc-600" disabled={busy} onClick={onImport}>
                Ouvrir un fichier .envolees…
            </Button>
            {storage && <p className="text-xs text-slate-400 dark:text-zinc-500 text-center">Données enregistrées sur cet appareil, dans ce navigateur · {storage}</p>}
        </div>
    );
};

export default ClassLibrary;
