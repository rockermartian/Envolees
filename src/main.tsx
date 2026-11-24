// Point d'entrée de la version web : l'application Envolées elle-même (App.tsx, recopiée dans app/),
// avec le navigateur à la place d'Electron (voir desktop/electronBridge.tsx).
import './styles.css';
import { setImageBackend } from '../app/images/imageStore';
import { mountDesktop } from './desktop/mountDesktop';
import { openDb } from './platform/db';
import { mountPlatformHost } from './platform/dialogs';
import { startLaunchQueue } from './platform/launch';
import { registerServiceWorker } from './platform/updates';
import { webImages } from './platform/webImages';

// Images des classes : dans IndexedDB (à poser avant tout affichage).
setImageBackend(webImages);
mountPlatformHost();
registerServiceWorker();

// Un fichier déposé hors d'une zone prévue ne doit jamais remplacer l'application.
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

const launchFiles = startLaunchQueue();
openDb()
    .then(() => mountDesktop(launchFiles))
    .catch(error => {
        console.error(error);
        const root = document.getElementById('root')!;
        root.textContent = `Envolées ne peut pas démarrer dans ce navigateur : ${error instanceof Error ? error.message : String(error)}`;
        root.style.padding = '2rem';
    });
