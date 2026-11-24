import React, { useCallback, useEffect, useState } from 'react';
import useModalDismiss from '../hooks/useModalDismiss';

// Envoi vers Nuage et ouverture depuis Nuage (cloud de l'Éducation nationale).
// La connexion se fait dans le navigateur de l'ordinateur ; le processus principal garde l'accès.

export interface NuageStatus { connected: boolean; displayName?: string; loginName?: string; server?: string; persisted?: boolean }
export interface NuageEntry { name: string; path: string; isFolder: boolean; size: number | null; modified: string | null }

interface NuageModalProps {
    mode: 'upload' | 'open';
    /** Nom du fichier de classe envoyé (mode « upload »). */
    fileName?: string | null;
    onClose: () => void;
    /** Ouvre un fichier de Nuage ; renvoie true si la classe est ouverte (la fenêtre se ferme alors). */
    onOpenRemote?: (path: string) => Promise<boolean>;
}

const ROOT_FOLDER = 'Envolées';
const formatSize = (bytes: number | null) => (bytes == null ? '' : bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} Ko` : `${(bytes / 1e6).toFixed(1).replace('.', ',')} Mo`);
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const CloudIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
    </svg>
);

const NuageModal: React.FC<NuageModalProps> = ({ mode, fileName, onClose, onOpenRemote }) => {
    const [status, setStatus] = useState<NuageStatus | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [folder, setFolder] = useState(ROOT_FOLDER);
    const [entries, setEntries] = useState<NuageEntry[] | null>(null);

    const canClose = !busy || connecting;
    const close = () => { if (connecting) void window.electronAPI.nuageCancelConnect(); onClose(); };
    const handleBackdropClick = useModalDismiss(close, canClose);

    useEffect(() => { window.electronAPI.nuageStatus().then(setStatus).catch(() => setStatus({ connected: false })); }, []);
    useEffect(() => window.electronAPI.onNuageProgress(setProgress), []);

    const loadFolder = useCallback(async (target: string) => {
        setBusy('Lecture du dossier…');
        setError(null);
        try {
            const result = await window.electronAPI.nuageList(target);
            if ('error' in result) {
                setError(result.error);
                if (result.code === 'auth') setStatus({ connected: false });
                return;
            }
            setFolder(result.folder);
            setEntries(result.entries);
        } finally {
            setBusy(null);
        }
    }, []);

    useEffect(() => { if (mode === 'open' && status?.connected && entries === null) void loadFolder(ROOT_FOLDER); }, [mode, status, entries, loadFolder]);

    const connect = async () => {
        setConnecting(true);
        setBusy('Connexion en cours…');
        setError(null);
        try {
            const result = await window.electronAPI.nuageConnect();
            if ('error' in result) { if (result.code !== 'cancelled') setError(result.error); }
            else setStatus(result);
        } finally {
            setConnecting(false);
            setBusy(null);
        }
    };

    const upload = async () => {
        setBusy('Envoi vers Nuage…');
        setError(null);
        setProgress(null);
        try {
            const result = await window.electronAPI.nuageUpload();
            if ('error' in result) {
                setError(result.error);
                if (result.code === 'auth') setStatus({ connected: false });
                return;
            }
            setDone(result.replaced
                ? `La classe a été envoyée dans Nuage (dossier ${ROOT_FOLDER}). Elle remplace la version précédente, que Nuage garde dans l'historique du fichier.`
                : `La classe a été envoyée dans Nuage, dans le dossier ${ROOT_FOLDER}.`);
        } finally {
            setBusy(null);
        }
    };

    const openRemote = async (entry: NuageEntry) => {
        if (entry.isFolder) { void loadFolder(entry.path); return; }
        if (!onOpenRemote) return;
        setBusy(`Téléchargement de « ${entry.name} »…`);
        setError(null);
        try {
            if (await onOpenRemote(entry.path)) onClose();
        } finally {
            setBusy(null);
        }
    };

    const parent = folder.includes('/') ? folder.slice(0, folder.lastIndexOf('/')) : null;
    const percent = progress && progress.total ? Math.round((progress.sent / progress.total) * 100) : null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[101] p-4 print-hidden" role="dialog" aria-modal="true" aria-labelledby="nuage-title" onClick={handleBackdropClick}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg p-6 text-left flex flex-col max-h-[85vh]">
                <div className="flex items-center gap-3">
                    <CloudIcon className="w-8 h-8 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                        <h3 id="nuage-title" className="text-lg font-bold text-slate-800 dark:text-zinc-200">{mode === 'upload' ? 'Envoyer vers Nuage' : 'Ouvrir depuis Nuage'}</h3>
                        {status?.connected && <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">Connecté : {status.displayName} ({status.loginName})</p>}
                    </div>
                </div>

                <div className="mt-4 text-sm text-slate-600 dark:text-zinc-300 overflow-y-auto min-h-0">
                    {status === null ? (
                        <p>Vérification de la connexion…</p>
                    ) : !status.connected ? (
                        connecting ? (
                            <div className="space-y-2">
                                <p className="font-medium text-slate-800 dark:text-zinc-200">La page de connexion à Nuage s'est ouverte dans votre navigateur.</p>
                                <p>Connectez-vous avec votre identifiant académique, puis autorisez l'accès à Envolées. Revenez ensuite ici : la suite se fait automatiquement.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p>Nuage est l'espace de stockage en ligne de l'Éducation nationale (apps.education.fr). Envolées peut y envoyer vos classes et les y reprendre, d'un ordinateur à l'autre.</p>
                                <p>La connexion se fait une seule fois, dans votre navigateur, avec votre identifiant académique. L'accès donné à Envolées se retire à tout moment depuis Envolées (Paramètres) ou depuis Nuage (Paramètres › Sécurité).</p>
                            </div>
                        )
                    ) : mode === 'upload' ? (
                        done ? <p className="text-emerald-700 dark:text-emerald-400 font-medium">{done}</p> : (
                            <div className="space-y-3">
                                <p>La classe <strong className="text-slate-800 dark:text-zinc-200">{fileName ?? ''}</strong> sera copiée dans le dossier <strong>{ROOT_FOLDER}</strong> de votre Nuage. Si elle y est déjà, elle est remplacée : Nuage garde l'historique des versions.</p>
                                {busy && (
                                    <div className="h-2 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
                                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${percent ?? 5}%` }} />
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                                {parent !== null && (
                                    <button onClick={() => void loadFolder(parent)} disabled={!!busy} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600">← Dossier parent</button>
                                )}
                                <span className="truncate">Nuage › {folder.split('/').join(' › ')}</span>
                                <button onClick={() => void loadFolder(folder)} disabled={!!busy} className="ml-auto px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700">Actualiser</button>
                            </div>
                            {entries && entries.length === 0 && (
                                <p className="py-4 text-center">Aucune classe dans ce dossier. Envoyez-en une depuis Envolées (Menu › Envoyer vers Nuage).</p>
                            )}
                            {entries && entries.length > 0 && (
                                <ul className="divide-y divide-slate-100 dark:divide-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                    {entries.map(entry => {
                                        const usable = entry.isFolder || entry.name.toLowerCase().endsWith('.envolees');
                                        return (
                                            <li key={entry.path}>
                                                <button onClick={() => void openRemote(entry)} disabled={!usable || !!busy}
                                                    className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-zinc-700/60 disabled:opacity-40 disabled:cursor-not-allowed">
                                                    <span aria-hidden="true">{entry.isFolder ? '📁' : '📄'}</span>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block truncate text-slate-800 dark:text-zinc-200">{entry.name}</span>
                                                        {!entry.isFolder && <span className="block text-xs text-slate-500 dark:text-zinc-400">{[formatSize(entry.size), formatDate(entry.modified)].filter(Boolean).join(' · ')}</span>}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                    {busy && !connecting && mode === 'open' && <p className="mt-3 text-slate-500 dark:text-zinc-400">{busy}</p>}
                    {error && <p role="alert" className="mt-3 text-red-600 dark:text-red-400">{error}</p>}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={close} disabled={!canClose} className="px-4 py-2 rounded-md bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold disabled:opacity-50">
                        {done ? 'Fermer' : 'Annuler'}
                    </button>
                    {status && !status.connected && !connecting && (
                        <button onClick={() => void connect()} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold">Se connecter à Nuage</button>
                    )}
                    {status?.connected && mode === 'upload' && !done && (
                        <button onClick={() => void upload()} disabled={!!busy} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold disabled:opacity-50">
                            {busy ? (percent != null ? `Envoi… ${percent} %` : 'Envoi…') : 'Envoyer'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NuageModal;
