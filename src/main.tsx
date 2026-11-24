// Point d'entrée de la version web.
import './styles.css';
import { setImageBackend } from '../../images/imageStore';
import { openDb } from './platform/db';
import { mountPlatformHost } from './platform/dialogs';
import { startLaunchQueue } from './platform/launch';
import { registerServiceWorker } from './platform/updates';
import { webImages } from './platform/webImages';
import { resolveUiMode } from './uiMode';

// Images des classes : dans IndexedDB (à poser avant tout affichage).
setImageBackend(webImages);
mountPlatformHost();
registerServiceWorker();

// Un fichier déposé hors d'une zone prévue ne doit jamais remplacer l'application.
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

const launchFiles = startLaunchQueue();
const mode = resolveUiMode();
document.documentElement.dataset.ui = mode;

const showFatal = (message: string) => {
    const root = document.getElementById('root')!;
    root.textContent = '';
    const box = document.createElement('div');
    box.className = 'h-full flex items-center justify-center p-6 text-center bg-slate-100 text-slate-700';
    const p = document.createElement('p');
    p.className = 'max-w-md';
    p.textContent = message;
    box.appendChild(p);
    root.appendChild(box);
};

openDb()
    .then(() => (mode === 'desktop'
        ? import('./desktop/mountDesktop').then(m => m.mountDesktop(launchFiles))
        : import('./mobile/mountMobile').then(m => m.mountMobile(launchFiles))))
    .catch(error => {
        console.error(error);
        showFatal(`Envolées ne peut pas démarrer dans ce navigateur : ${error instanceof Error ? error.message : String(error)}`);
    });
