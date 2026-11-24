// Point d'entrée de la version web (ordinateur et tablette).
import './styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { setImageBackend } from '../core/images/imageStore';
import { openDb } from './platform/db';
import { mountPlatformHost } from './platform/dialogs';
import { startLaunchQueue } from './platform/launch';
import { registerServiceWorker } from './platform/updates';
import { webImages } from './platform/webImages';
import App from './ui/App';
import ErrorBoundary from './ui/ErrorBoundary';

// Images des classes : dans IndexedDB (à poser avant tout affichage).
setImageBackend(webImages);
mountPlatformHost();
registerServiceWorker();

// Un fichier déposé hors d'une zone prévue ne doit jamais remplacer l'application.
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
const launchFiles = startLaunchQueue();
const root = document.getElementById('root')!;

openDb()
    .then(() => {
        ReactDOM.createRoot(root).render(
            <React.StrictMode>
                <ErrorBoundary><App launchFiles={launchFiles} /></ErrorBoundary>
            </React.StrictMode>,
        );
    })
    .catch(error => {
        console.error(error);
        root.textContent = `Envolées ne peut pas démarrer dans ce navigateur : ${error instanceof Error ? error.message : String(error)}`;
        root.style.padding = '2rem';
    });
