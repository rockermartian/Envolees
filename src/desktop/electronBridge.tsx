// Pont « window.electronAPI » de la version web.
//
// L'interface ordinateur est l'application de bureau elle-même (App.tsx et components/, importés tels
// quels). Elle ne parle au système que par window.electronAPI (voir electron/preload.js) : on fournit
// ici la même interface, réalisée avec les moyens du navigateur.
//
//   Electron (processus principal)        Version web
//   fichier .envolees sur le disque   →   classe enregistrée dans le navigateur (+ fichier lié éventuel)
//   images dans classFile.js          →   IndexedDB (platform/webImages.ts)
//   boîtes de dialogue natives        →   platform/dialogs.tsx
//   printToPDF                        →   impression du navigateur (« Enregistrer au format PDF »)
//   fermeture de la fenêtre           →   avertissement « beforeunload »
import React from 'react';
import ClassLibrary from '../platform/ClassLibrary';
import { askChoice, askName, Button, Panel, showDialog, showMessage } from '../platform/dialogs';
import { exportClassFile, formatDateTime } from '../platform/exporting';
import { canLinkFiles, downloadBlob, envoleesFileName, pickImageAsDataUrl, pickSaveLocation, writeLinkedFile, type LinkedFileHandle } from '../platform/fileAccess';
import { buildClassFile, getClass, getLastClassId, imageNamesOf, listBackups, markExported, setLastClassId } from '../platform/library';
import { createAndOpenClass, currentClassId, describeError, importClassFile, openClass, saveCurrentClass } from '../platform/session';
import { webImages } from '../platform/webImages';
import { nuageSendMessage, pickClassFromNuage, sendClassToNuage } from '../platform/nuageAssist';

type ElectronApi = Window['electronAPI'];
const NUAGE_WEB = "Dans la version web, l'envoi vers Nuage passe par le navigateur.";
type OpenResult = { dataJson: string; filePath: string };

const asOpenResult = (record: { name: string; dataJson: string }): OpenResult =>
    ({ dataJson: record.dataJson, filePath: envoleesFileName(record.name) });

const userIsActing = () => (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive ?? false;

// ---------------------------------------------------------------------------------------------
// Ouvrir
// ---------------------------------------------------------------------------------------------

type LibraryChoice = { open: string } | { import: true } | null;

const chooseClass = () => showDialog<LibraryChoice>(close => (
    <Panel title="Ouvrir une classe" wide footer={<>
        <Button onClick={() => close(null)}>Annuler</Button>
    </>}>
        <ClassLibrary currentId={currentClassId()} onOpen={id => close({ open: id })} onImport={() => close({ import: true })} />
    </Panel>
), null);

async function openFile(): Promise<OpenResult | { error: string } | null> {
    try {
        const choice = await chooseClass();
        if (!choice) return null;
        const id = 'open' in choice ? choice.open : await importClassFile();
        if (!id) return null;
        return asOpenResult(await openClass(id));
    } catch (error) {
        return { error: describeError(error) };
    }
}

async function openLastFile(): Promise<OpenResult | { error: string }> {
    try {
        const id = await getLastClassId();
        if (!id || !(await getClass(id))) return { error: "La dernière classe n'existe plus dans ce navigateur." };
        return asOpenResult(await openClass(id));
    } catch (error) {
        return { error: describeError(error) };
    }
}

async function getLastFileName(): Promise<string | null> {
    await launchHandled;
    const id = await getLastClassId().catch(() => undefined);
    const record = id ? await getClass(id).catch(() => undefined) : undefined;
    return record ? record.name : null;
}

// ---------------------------------------------------------------------------------------------
// Enregistrer
// ---------------------------------------------------------------------------------------------

async function saveFile(dataJson: string, refs: string[]): Promise<{ success: boolean; error?: string }> {
    try {
        await saveCurrentClass(dataJson, refs, userIsActing());
        return { success: true };
    } catch (error) {
        return { success: false, error: describeError(error) };
    }
}

const linkOption = ({ link, setLink }: { link: boolean; setLink: (v: boolean) => void }) => canLinkFiles() ? (
    <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-zinc-300">
        <input type="checkbox" checked={link} onChange={e => setLink(e.target.checked)} className="mt-0.5" />
        <span><strong>Enregistrer aussi dans un fichier sur cet ordinateur</strong> (recommandé) : il sera mis à jour à chaque enregistrement et servira de sauvegarde.</span>
    </label>
) : (
    <p className="text-sm text-slate-500 dark:text-zinc-400">La classe est enregistrée dans ce navigateur. Pensez à l'exporter régulièrement en fichier .envolees (Menu › Enregistrer sous) pour la sauvegarder ou l'ouvrir sur un autre appareil.</p>
);

/** Crée une classe (vide ou copie) ; avec `link`, demande où écrire son fichier. */
async function createClassFrom(name: string, dataJson: string, refs: string[], link: boolean): Promise<{ success: boolean; path?: string; error?: string } | null> {
    let handle: LinkedFileHandle | null = null;
    if (link && canLinkFiles()) {
        handle = await pickSaveLocation(envoleesFileName(name));
        if (!handle) return null;
    }
    const record = await createAndOpenClass({ name, dataJson, images: imageNamesOf(refs), handle });
    if (handle) {
        await writeLinkedFile(handle, await buildClassFile(record.dataJson, record.images));
        await markExported(record.id);
    }
    return { success: true, path: envoleesFileName(record.name) };
}

type SaveAsChoice = { copy: { name: string; link: boolean } } | { download: true } | { share: true } | null;

async function saveFileAs(dataJson: string, refs: string[], options: { newFile?: boolean } = {}) {
    try {
        if (options.newFile) {
            const answer = await askName('Nouvelle classe', 'Nom de la classe', `Classe ${new Date().getFullYear()}`, 'Créer', linkOption);
            return answer ? await createClassFrom(answer.name, dataJson, refs, answer.link) : null;
        }

        const id = currentClassId();
        const currentName = id ? (await getClass(id))?.name ?? 'Ma classe' : 'Ma classe';
        const choice = await showDialog<SaveAsChoice>(close => <SaveAsPanel currentName={currentName} hasCurrent={!!id} onDone={close} />, null);
        if (!choice) return null;
        if ('copy' in choice) return await createClassFrom(choice.copy.name, dataJson, refs, choice.copy.link);

        // Export d'une copie : la classe ouverte est d'abord enregistrée, puis exportée telle quelle.
        if (!id) return null;
        await saveCurrentClass(dataJson, refs, true);
        const outcome = await exportClassFile(id, 'share' in choice ? 'share' : 'download');
        return outcome === 'cancelled' ? null : { success: true, path: envoleesFileName(currentName) };
    } catch (error) {
        return { success: false, error: describeError(error) };
    }
}

const SaveAsPanel: React.FC<{ currentName: string; hasCurrent: boolean; onDone: (c: SaveAsChoice) => void }> = ({ currentName, hasCurrent, onDone }) => {
    const [name, setName] = React.useState(`${currentName} (copie)`);
    const [link, setLink] = React.useState(true);
    const canShare = typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;
    return (
        <Panel title="Enregistrer sous" footer={<Button onClick={() => onDone(null)}>Annuler</Button>}>
            <div className="space-y-5">
                {hasCurrent && (
                    <section className="space-y-2">
                        <h3 className="font-semibold">Exporter un fichier .envolees</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">Pour sauvegarder la classe, l'ouvrir sur un autre appareil (téléphone, autre ordinateur) ou dans l'application de bureau.</p>
                        <div className="flex flex-wrap gap-2">
                            <Button kind="primary" onClick={() => onDone({ download: true })}>Télécharger le fichier</Button>
                            {canShare && <Button onClick={() => onDone({ share: true })}>Partager…</Button>}
                        </div>
                    </section>
                )}
                <section className="space-y-2">
                    <h3 className="font-semibold">Enregistrer une copie dans ce navigateur</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">La copie devient la classe ouverte ; « {currentName} » reste inchangée.</p>
                    <input value={name} onChange={e => setName(e.target.value)} aria-label="Nom de la copie" maxLength={80}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    {linkOption({ link, setLink })}
                    <Button disabled={!name.trim()} onClick={() => onDone({ copy: { name: name.trim(), link } })}>Enregistrer la copie</Button>
                </section>
            </div>
        </Panel>
    );
};

// ---------------------------------------------------------------------------------------------
// Copies de sécurité (« Ouvrir le dossier des copies de sécurité »)
// ---------------------------------------------------------------------------------------------

async function openBackupsFolder(): Promise<{ success?: boolean; error?: string }> {
    const id = currentClassId();
    if (!id) {
        await showMessage('Copies de sécurité', 'Ouvrez une classe pour voir ses copies de sécurité.');
        return { success: true };
    }
    const backups = await listBackups(id);
    await showDialog<null>(close => (
        <Panel title="Copies de sécurité" footer={<Button onClick={() => close(null)}>Fermer</Button>}>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-3">Avant chaque enregistrement, la version précédente est gardée (3 copies au plus, une toutes les 30 minutes au plus). Une copie se restaure en fichier .envolees, à rouvrir ensuite.</p>
            {backups.length === 0 ? <p>Aucune copie pour l'instant.</p> : (
                <ul className="divide-y divide-slate-200 dark:divide-zinc-700">
                    {backups.map(b => (
                        <li key={b.id} className="py-2 flex items-center justify-between gap-3">
                            <span>{b.name} — {formatDateTime(b.savedAt)}</span>
                            <Button onClick={async () => {
                                try {
                                    const blob = await buildClassFile(b.dataJson, b.images);
                                    downloadBlob(blob, envoleesFileName(`${b.name} (copie du ${new Date(b.savedAt).toLocaleDateString('fr-FR').replace(/\//g, '-')})`));
                                } catch (error) {
                                    await showMessage('Copie de sécurité', describeError(error));
                                }
                            }}>Télécharger</Button>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    ), null);
    return { success: true };
}

// ---------------------------------------------------------------------------------------------
// Impression / PDF
// ---------------------------------------------------------------------------------------------

// LivretView attend un PDF (base64) qu'il propose ensuite en téléchargement. Le navigateur ne sait
// pas produire de PDF lui-même : on ouvre la boîte d'impression (« Enregistrer au format PDF ») et
// on renvoie un PDF factice dont le téléchargement est ensuite ignoré.
const PRINTED_MARKER = btoa('%PDF-1.4\n% imprimé par le navigateur\n');
let swallowPdfDownloadUntil = 0;
const originalClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
    if (Date.now() < swallowPdfDownloadUntil && this.href.startsWith('blob:') && /\.pdf$/i.test(this.download)) {
        swallowPdfDownloadUntil = 0;
        return;
    }
    return originalClick.call(this);
};

let printNoticeShown = false;
const waitForPrint = (title?: string) => new Promise<void>(resolve => {
    const previousTitle = document.title;
    if (title) document.title = title; // nom proposé pour le fichier PDF
    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        document.title = previousTitle;
        resolve();
    };
    window.addEventListener('afterprint', finish, { once: true });
    // Les images doivent être prêtes avant d'imprimer.
    requestAnimationFrame(() => setTimeout(() => {
        window.print();
        setTimeout(finish, 500);
    }, 50));
});

async function generateLivretPdf(options?: { dirToken: string; fileName: string }): Promise<{ success: boolean; data?: string; error?: string }> {
    if (!printNoticeShown) {
        printNoticeShown = true;
        await showMessage('Exporter en PDF',
            "Dans la version web, le livret passe par l'impression du navigateur.\n\nChoisissez « Enregistrer au format PDF » (ou « Microsoft Print to PDF ») comme imprimante, puis enregistrez. Pensez à désactiver « En-têtes et pieds de page » dans les options d'impression.");
    }
    await waitForPrint(options?.fileName?.replace(/\.pdf$/i, ''));
    if (options?.dirToken) return { success: true };
    swallowPdfDownloadUntil = Date.now() + 5000;
    return { success: true, data: PRINTED_MARKER };
}

async function selectDirectory(): Promise<{ token: string; label: string } | null> {
    const ok = await askChoice('Exporter tous les livrets',
        "La version web imprime les livrets l'un après l'autre : une boîte d'impression s'ouvre pour chaque élève, avec le nom du fichier déjà proposé. Choisissez « Enregistrer au format PDF ».\n\nPour exporter tous les livrets d'un coup dans un dossier, utilisez l'application de bureau.",
        [{ label: 'Annuler', value: false }, { label: 'Commencer', value: true, kind: 'primary' }], false);
    return ok ? { token: 'web-print', label: 'impression' } : null;
}

// ---------------------------------------------------------------------------------------------
// Fermeture
// ---------------------------------------------------------------------------------------------

const closeListeners = new Set<() => Promise<void>>();
let allowUnload = false;
let forceCloseRequested = false;
let insideBeforeUnload = false;

window.addEventListener('beforeunload', event => {
    if (allowUnload || closeListeners.size === 0) return;
    // L'application décide sans attendre : fermeture immédiate (forceCloseApp) si tout est enregistré,
    // sinon sa fenêtre « Enregistrer avant de quitter ? » s'affiche — et le navigateur demande confirmation.
    forceCloseRequested = false;
    insideBeforeUnload = true;
    try {
        closeListeners.forEach(listener => { void listener(); });
    } finally {
        insideBeforeUnload = false;
    }
    if (!forceCloseRequested) {
        event.preventDefault();
        event.returnValue = '';
    }
});

function forceCloseApp() {
    forceCloseRequested = true;
    // Appel pendant « beforeunload » (tout est enregistré) : on laisse simplement la page se fermer
    // ou se recharger. Surtout pas window.close() : une application installée se fermerait au rechargement.
    if (insideBeforeUnload || allowUnload) return;
    allowUnload = true;
    // Bouton « Quitter » de l'application : une fenêtre d'application installée se ferme ; un onglet
    // ne peut pas toujours se fermer seul, on revient alors à l'écran d'accueil.
    setTimeout(() => {
        window.close();
        setTimeout(() => window.location.reload(), 300);
    }, 0);
}

// ---------------------------------------------------------------------------------------------
// Fichier transmis au lancement (application installée : double-clic sur un .envolees)
// ---------------------------------------------------------------------------------------------

let launchHandled: Promise<void> = Promise.resolve();
export function handleLaunchFiles(files: Promise<{ file: File; handle?: LinkedFileHandle }[]>) {
    launchHandled = files.then(async list => {
        for (const picked of list) {
            try {
                const id = await importClassFile(picked);
                if (id) await setLastClassId(id);
            } catch (error) {
                await showMessage("Impossible d'ouvrir le fichier", describeError(error));
            }
        }
    });
}

// ---------------------------------------------------------------------------------------------

export function installElectronBridge() {
    const api: ElectronApi = {
        openFile,
        openLastFile,
        getLastFileName,
        saveFile,
        saveFileAs,
        putImage: (bytes, mime) => webImages.put(bytes, mime),
        openBackupsFolder,
        selectDirectory,
        generateLivretPdf,
        openImageFile: pickImageAsDataUrl,
        showUnsavedDialog: () => askChoice('Modifications non enregistrées', 'Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?',
            [{ label: 'Annuler', value: 2 }, { label: 'Ne pas enregistrer', value: 1 }, { label: 'Enregistrer', value: 0, kind: 'primary' }], 2),
        // Fenêtre : gérée par le navigateur (les boutons de fenêtre de l'application sont masqués, voir styles.css).
        minimizeWindow: () => undefined,
        maximizeWindow: () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); },
        closeWindow: () => window.close(),
        onWindowMaximized: () => undefined,
        onWindowUnmaximized: () => undefined,
        removeWindowMaximizeListeners: () => undefined,
        onCloseRequested: callback => {
            closeListeners.add(callback);
            return () => { closeListeners.delete(callback); };
        },
        forceCloseApp,
        openGuide: async theme => {
            window.open(`./guide/index.html?theme=${theme === 'dark' ? 'dark' : 'light'}`, '_blank', 'noopener');
        },
        // Nuage : connexion directe impossible depuis un site (pas d'en-têtes CORS) → mode assisté.
        nuageStatus: async () => ({ connected: false }),
        nuageConnect: async () => ({ error: NUAGE_WEB, code: 'web' }),
        nuageCancelConnect: async () => undefined,
        nuageDisconnect: async () => ({ connected: false }),
        nuageUpload: async () => ({ error: NUAGE_WEB, code: 'web' }),
        nuageList: async () => ({ error: NUAGE_WEB, code: 'web' }),
        nuageOpen: async () => ({ error: NUAGE_WEB, code: 'web' }),
        onNuageProgress: () => () => undefined,
        nuageAssisted: {
            send: async () => {
                const id = currentClassId();
                if (!id) return null;
                const message = nuageSendMessage(await sendClassToNuage(id));
                return message ? { message } : null;
            },
            open: async () => {
                try {
                    const picked = await pickClassFromNuage();
                    const id = picked ? await importClassFile(picked) : null;
                    return id ? asOpenResult(await openClass(id)) : null;
                } catch (error) {
                    return { error: describeError(error) };
                }
            },
        },
    };
    window.electronAPI = api;
}
