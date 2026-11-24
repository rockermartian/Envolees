// Interface ordinateur : l'application de bureau (App.tsx), avec le pont web à la place d'Electron.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../../../App';
import ErrorBoundary, { ErrorPanel } from '../../../components/ErrorBoundary';
import { showMessage } from '../platform/dialogs';
import { onLaterLaunch, type LaunchedFile } from '../platform/launch';
import { setLastClassId } from '../platform/library';
import { describeError, importClassFile } from '../platform/session';
import { handleLaunchFiles, installElectronBridge } from './electronBridge';

export function mountDesktop(launchFiles: Promise<LaunchedFile[]>) {
    installElectronBridge();
    handleLaunchFiles(launchFiles);
    // Fichier ouvert alors que l'application l'est déjà : importé, à ouvrir par Menu › Ouvrir une classe.
    onLaterLaunch(async files => {
        for (const picked of files) {
            try {
                const id = await importClassFile(picked);
                if (id) {
                    await setLastClassId(id);
                    await showMessage('Fichier importé', `« ${picked.file.name} » est maintenant dans vos classes : ouvrez-le par Menu › Ouvrir une classe.`);
                }
            } catch (error) {
                await showMessage("Impossible d'ouvrir le fichier", describeError(error));
            }
        }
    });

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <ErrorBoundary
                fallback={error => (
                    <ErrorPanel
                        title="Envolées a rencontré une erreur"
                        message="L'application doit être rechargée. Les modifications non enregistrées depuis le dernier enregistrement sont perdues."
                        error={error}
                        actions={<button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Recharger</button>}
                    />
                )}
            >
                <App />
            </ErrorBoundary>
        </React.StrictMode>,
    );
}
