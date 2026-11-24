// Fichiers .envolees ouverts par le système (application installée sur Chrome / Edge :
// double-clic sur un fichier, « Ouvrir avec Envolées »). Voir file_handlers dans manifest.webmanifest.
import type { LinkedFileHandle } from './fileAccess';

export type LaunchedFile = { file: File; handle?: LinkedFileHandle };
type LaunchParams = { files?: LinkedFileHandle[] };
type LaunchQueue = { setConsumer(consumer: (params: LaunchParams) => void): void };

let laterHandler: ((files: LaunchedFile[]) => void) | null = null;

const toFiles = async (params: LaunchParams): Promise<LaunchedFile[]> => {
    const out: LaunchedFile[] = [];
    for (const handle of params.files ?? []) {
        if (handle.kind !== 'file') continue;
        try { out.push({ file: await handle.getFile(), handle }); } catch (error) { console.warn('Fichier transmis illisible :', error); }
    }
    return out;
};

/**
 * Fichiers transmis au démarrage (liste vide si aucun, ou si le navigateur ne gère pas l'ouverture de fichiers).
 * Les lancements suivants (fichier ouvert alors que l'application l'est déjà) vont à `onLaterLaunch`.
 */
export function startLaunchQueue(): Promise<LaunchedFile[]> {
    const queue = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
    if (!queue?.setConsumer) return Promise.resolve([]);
    return new Promise(resolve => {
        let first = true;
        const timer = setTimeout(() => { first = false; resolve([]); }, 400);
        queue.setConsumer(params => {
            void toFiles(params).then(files => {
                if (first) {
                    first = false;
                    clearTimeout(timer);
                    resolve(files);
                } else if (files.length) {
                    laterHandler?.(files);
                }
            });
        });
    });
}

export const onLaterLaunch = (handler: (files: LaunchedFile[]) => void) => { laterHandler = handler; };
