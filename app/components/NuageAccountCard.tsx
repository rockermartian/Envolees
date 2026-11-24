import React, { useEffect, useState } from 'react';
import type { NuageStatus } from './NuageModal';

// Paramètres › Nuage : compte connecté et déconnexion (l'accès est aussi retiré côté Nuage).
const NuageAccountCard: React.FC = () => {
    const [status, setStatus] = useState<NuageStatus | null>(null);
    const [busy, setBusy] = useState(false);

    const assisted = !!window.electronAPI?.nuageAssisted;
    useEffect(() => { if (!assisted) window.electronAPI?.nuageStatus().then(setStatus).catch(() => setStatus({ connected: false })); }, [assisted]);
    if (!window.electronAPI) return null;

    const disconnect = async () => {
        setBusy(true);
        try { setStatus(await window.electronAPI.nuageDisconnect()); } finally { setBusy(false); }
    };

    return (
        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-slate-200 dark:border-zinc-700">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                    </svg>
                </div>
                <div className="flex-grow">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-200">Nuage (apps.education.fr)</h3>
                    {assisted ? (
                        <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Dans la version web, l'envoi et l'ouverture passent par votre navigateur : application Nextcloud sur tablette, onglet Nuage sur ordinateur (Menu › Envoyer vers Nuage / Ouvrir depuis Nuage).</p>
                    ) : status === null ? (
                        <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Vérification…</p>
                    ) : status.connected ? (
                        <>
                            <p className="text-slate-600 dark:text-zinc-300 text-sm mt-1">Connecté : <strong>{status.displayName}</strong> ({status.loginName})</p>
                            {!status.persisted && <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">Ce système ne permet pas de conserver l'accès de façon chiffrée : il faudra se reconnecter au prochain lancement.</p>}
                            <button type="button" onClick={() => void disconnect()} disabled={busy} className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                                Se déconnecter de Nuage
                            </button>
                        </>
                    ) : (
                        <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">Non connecté. La connexion se propose à la première utilisation (Menu › Envoyer vers Nuage, ou Ouvrir depuis Nuage).</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NuageAccountCard;
