// Service worker : fonctionnement hors ligne et mises à jour de l'application.
// Une nouvelle version n'est jamais appliquée d'office : un bandeau propose de recharger.
import React from 'react';
import { Button, hideBanner, showBanner } from './dialogs';

let reloadRequested = false;

const UpdateBanner: React.FC<{ onReload: () => void }> = ({ onReload }) => (
    <div role="status" className="flex items-center gap-3 bg-indigo-700 text-white rounded-xl shadow-xl px-4 py-3">
        <span className="flex-1 text-sm">Une nouvelle version d'Envolées est disponible.</span>
        <Button kind="secondary" className="!min-h-9 !py-1.5" onClick={() => hideBanner('update')}>Plus tard</Button>
        <Button kind="secondary" className="!min-h-9 !py-1.5 font-semibold" onClick={onReload}>Recharger</Button>
    </div>
);

export function registerServiceWorker(): void {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;

    const offerUpdate = (worker: ServiceWorker) => showBanner('update', <UpdateBanner onReload={() => {
        reloadRequested = true;
        worker.postMessage('skip-waiting');
    }} />);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Première installation : rien à recharger. Mise à jour acceptée : on recharge une fois.
        if (!hadController || !reloadRequested) return;
        reloadRequested = false;
        window.location.reload();
    });

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
            if (registration.waiting && hadController) offerUpdate(registration.waiting);
            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                worker?.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
                });
            });
            setInterval(() => { void registration.update().catch(() => undefined); }, 60 * 60 * 1000);
        } catch (error) {
            console.warn('Service worker non enregistré (pas de fonctionnement hors ligne) :', error);
        }
    });
}
