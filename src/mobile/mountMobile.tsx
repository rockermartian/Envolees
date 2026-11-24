// Interface mobile (téléphone).
import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary, { ErrorPanel } from '../../app/components/ErrorBoundary';
import type { LaunchedFile } from '../platform/launch';
import MobileApp from './MobileApp';

export function mountMobile(launchFiles: Promise<LaunchedFile[]>) {
    if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <ErrorBoundary
                fallback={error => (
                    <ErrorPanel
                        title="Envolées a rencontré une erreur"
                        message="Les modifications sont enregistrées au fur et à mesure sur l'appareil : rechargez pour reprendre."
                        error={error}
                        actions={<button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Recharger</button>}
                    />
                )}
            >
                <MobileApp launchFiles={launchFiles} />
            </ErrorBoundary>
        </React.StrictMode>,
    );
}
