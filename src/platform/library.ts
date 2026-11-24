// Classes enregistrées dans le navigateur (équivalent web des fichiers .envolees sur le disque).
//
// Chaque classe = son data.json + la liste de ses images (partagées et dédupliquées entre classes).
// Une classe peut être « liée » à un fichier de l'ordinateur (Chrome / Edge) : il est alors réécrit à
// chaque enregistrement. Sinon, le fichier .envolees s'obtient par export (téléchargement, partage).
//
// Copies de sécurité : comme l'application de bureau, 3 copies par classe, au plus une toutes les
// 30 minutes, prises avant d'écraser la version précédente.
import { imageFileName, isImageRef } from '../../../images/imageStore';
import { buildEnvoleesBlob, readEnvoleesFile, type ArchiveImageBlob } from './archive';
import { STORES, getAllValues, getSetting, getValue, promisify, setSetting, transaction } from './db';
import { envoleesFileName, hasWritePermission, writeLinkedFile, type LinkedFileHandle } from './fileAccess';
import { webImages } from './webImages';

export interface ClassRecord {
    id: string;
    name: string;
    dataJson: string;
    /** Noms des images de la classe ("<empreinte>.<ext>"). */
    images: string[];
    createdAt: string;
    updatedAt: string;
    /** Dernière écriture d'un fichier .envolees (export, partage ou fichier lié). */
    exportedAt?: string | null;
    /** Fichier de l'ordinateur réécrit à chaque enregistrement (Chrome / Edge). */
    handle?: LinkedFileHandle | null;
    studentCount?: number;
}

export type ClassSummary = Omit<ClassRecord, 'dataJson' | 'images'> & { imageCount: number };

export interface BackupRecord {
    id: string;
    classId: string;
    name: string;
    dataJson: string;
    images: string[];
    savedAt: string;
}

const BACKUPS_PER_CLASS = 3;
const BACKUP_INTERVAL_MS = 30 * 60 * 1000;
/** Une image rangée récemment n'est jamais supprimée par le ménage (photo prise, classe pas encore enregistrée). */
const IMAGE_GRACE_MS = 24 * 60 * 60 * 1000;

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const countStudents = (dataJson: string) => (dataJson.match(/"firstName":/g) ?? []).length;

export const imageNamesOf = (refs: Iterable<string>): string[] =>
    [...new Set([...refs].filter(isImageRef).map(imageFileName))];

const summarize = ({ dataJson: _d, images, ...rest }: ClassRecord): ClassSummary => ({ ...rest, imageCount: images.length });

// ---------------------------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------------------------

export async function listClasses(): Promise<ClassSummary[]> {
    const records = await getAllValues<ClassRecord>(STORES.classes);
    return records.map(summarize).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const getClass = (id: string) => getValue<ClassRecord>(STORES.classes, id);

/** Charge une classe et ses images (prête à afficher). */
export async function loadClass(id: string): Promise<ClassRecord> {
    const record = await getClass(id);
    if (!record) throw new Error("Cette classe n'existe plus dans ce navigateur.");
    const missing = await webImages.load(record.images);
    if (missing.length) console.warn(`${missing.length} image(s) introuvable(s) pour la classe ${record.name}`);
    return record;
}

export const getLastClassId = () => getSetting<string>('lastClassId');
export const setLastClassId = (id: string | null) => setSetting('lastClassId', id);

// ---------------------------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------------------------

export async function createClass(input: { name: string; dataJson: string; images: string[]; handle?: LinkedFileHandle | null; exportedAt?: string | null }): Promise<ClassRecord> {
    const stamp = now();
    const record: ClassRecord = {
        id: newId(),
        name: input.name.trim() || 'Ma classe',
        dataJson: input.dataJson,
        images: input.images,
        createdAt: stamp,
        updatedAt: stamp,
        exportedAt: input.exportedAt ?? null,
        handle: input.handle ?? null,
        studentCount: countStudents(input.dataJson),
    };
    await transaction([STORES.classes], 'readwrite', tx => { tx.objectStore(STORES.classes).put(record); });
    void requestPersistentStorage();
    return record;
}

/**
 * Enregistre le contenu d'une classe (et prend une copie de sécurité de la version précédente).
 * Écriture atomique : tout ou rien (transaction IndexedDB).
 */
export async function saveClass(id: string, dataJson: string, images: string[]): Promise<ClassRecord> {
    const stamp = now();
    const updated = await transaction([STORES.classes, STORES.backups], 'readwrite', async tx => {
        const classes = tx.objectStore(STORES.classes);
        const backups = tx.objectStore(STORES.backups);
        const previous = await promisify(classes.get(id) as IDBRequest<ClassRecord | undefined>);
        if (!previous) throw new Error("Cette classe n'existe plus dans ce navigateur.");
        const record: ClassRecord = { ...previous, dataJson, images, updatedAt: stamp, studentCount: countStudents(dataJson) };
        classes.put(record);

        if (previous.dataJson !== dataJson) {
            const existing = (await promisify(backups.index('classId').getAll(id) as IDBRequest<BackupRecord[]>))
                .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
            const latest = existing[0];
            if (!latest || Date.now() - Date.parse(latest.savedAt) >= BACKUP_INTERVAL_MS) {
                backups.put({ id: newId(), classId: id, name: previous.name, dataJson: previous.dataJson, images: previous.images, savedAt: previous.updatedAt });
                for (const old of existing.slice(BACKUPS_PER_CLASS - 1)) backups.delete(old.id);
            }
        }
        return record;
    });
    return updated;
}

export async function updateClassMeta(id: string, changes: Partial<Pick<ClassRecord, 'name' | 'handle' | 'exportedAt'>>): Promise<void> {
    await transaction([STORES.classes], 'readwrite', async tx => {
        const store = tx.objectStore(STORES.classes);
        const record = await promisify(store.get(id) as IDBRequest<ClassRecord | undefined>);
        if (record) store.put({ ...record, ...changes });
    });
}

export async function deleteClass(id: string): Promise<void> {
    await transaction([STORES.classes, STORES.backups], 'readwrite', async tx => {
        tx.objectStore(STORES.classes).delete(id);
        const backups = tx.objectStore(STORES.backups);
        const keys = await promisify(backups.index('classId').getAllKeys(id));
        keys.forEach(key => backups.delete(key));
    });
    if ((await getLastClassId()) === id) await setLastClassId(null);
    await collectUnusedImages();
}

// ---------------------------------------------------------------------------------------------
// Fichiers .envolees
// ---------------------------------------------------------------------------------------------

/** Lit un fichier .envolees et range ses images dans le navigateur. */
export async function readClassFile(file: Blob): Promise<{ dataJson: string; images: string[] }> {
    const { dataJson, images } = await readEnvoleesFile(file);
    await webImages.storeMany(images);
    return { dataJson, images: images.map(i => i.name) };
}

/** Classe déjà liée à ce fichier de l'ordinateur (même fichier, même s'il a été renommé). */
export async function findClassByHandle(handle: LinkedFileHandle): Promise<ClassSummary | null> {
    if (!handle.isSameEntry) return null;
    for (const summary of await listClasses()) {
        if (summary.handle && await summary.handle.isSameEntry!(handle).catch(() => false)) return summary;
    }
    return null;
}

/** Contenu d'une classe sous forme de fichier .envolees. */
export async function buildClassFile(dataJson: string, images: string[]): Promise<Blob> {
    const missing = await webImages.load(images);
    const entries: ArchiveImageBlob[] = [];
    for (const name of images) {
        const entry = webImages.entry(name);
        if (entry) entries.push({ name, blob: entry.blob, crc32: entry.crc32 });
    }
    if (missing.length) console.warn(`${missing.length} image(s) absente(s) du fichier exporté`);
    return buildEnvoleesBlob(dataJson, entries, `${__APP_VERSION__}-web`);
}

export async function exportClass(id: string): Promise<{ blob: Blob; fileName: string; name: string }> {
    const record = await loadClass(id);
    return { blob: await buildClassFile(record.dataJson, record.images), fileName: envoleesFileName(record.name), name: record.name };
}

export const markExported = (id: string) => updateClassMeta(id, { exportedAt: now() });

export type LinkedWriteResult = 'written' | 'not-linked' | 'permission-needed' | { error: string };

/**
 * Réécrit le fichier lié d'une classe (si elle en a un et que l'écriture est autorisée).
 * `ask` : demander l'autorisation (seulement pendant un clic de l'utilisateur).
 */
export async function writeLinkedClassFile(id: string, ask: boolean): Promise<LinkedWriteResult> {
    const record = await getClass(id);
    if (!record?.handle) return 'not-linked';
    if (!(await hasWritePermission(record.handle, ask))) return 'permission-needed';
    try {
        await writeLinkedFile(record.handle, await buildClassFile(record.dataJson, record.images));
        await markExported(id);
        return 'written';
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}

// ---------------------------------------------------------------------------------------------
// Copies de sécurité
// ---------------------------------------------------------------------------------------------

export async function listBackups(classId: string): Promise<BackupRecord[]> {
    const all = await transaction([STORES.backups], 'readonly', tx =>
        promisify(tx.objectStore(STORES.backups).index('classId').getAll(classId) as IDBRequest<BackupRecord[]>));
    return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

// ---------------------------------------------------------------------------------------------
// Ménage et stockage
// ---------------------------------------------------------------------------------------------

/** Supprime les images qui n'appartiennent plus à aucune classe ni copie de sécurité. */
export async function collectUnusedImages(): Promise<number> {
    const [classes, backups] = await Promise.all([getAllValues<ClassRecord>(STORES.classes), getAllValues<BackupRecord>(STORES.backups)]);
    const used = new Set<string>([...classes, ...backups].flatMap(r => r.images));
    const removed: string[] = [];
    await transaction([STORES.images], 'readwrite', tx => new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(STORES.images).openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return resolve();
            const name = String(cursor.key);
            const value = cursor.value as { addedAt?: number };
            const recent = (value.addedAt ?? 0) > Date.now() - IMAGE_GRACE_MS;
            if (!used.has(name) && !recent) { cursor.delete(); removed.push(name); }
            cursor.continue();
        };
    }));
    removed.forEach(name => webImages.forget(name));
    return removed.length;
}

let persistenceAsked = false;
/** Demande au navigateur de ne pas effacer les données en cas de manque de place. */
export async function requestPersistentStorage(): Promise<boolean> {
    if (persistenceAsked || !navigator.storage?.persist) return false;
    persistenceAsked = true;
    try {
        return (await navigator.storage.persisted()) || (await navigator.storage.persist());
    } catch {
        return false;
    }
}

export async function storageInfo(): Promise<{ usage: number; quota: number; persisted: boolean } | null> {
    if (!navigator.storage?.estimate) return null;
    const [{ usage = 0, quota = 0 }, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? Promise.resolve(false)]);
    return { usage, quota, persisted };
}

// ---------------------------------------------------------------------------------------------
// Une classe ouverte dans un seul onglet à la fois (sinon deux onglets s'écraseraient)
// ---------------------------------------------------------------------------------------------

/** Réserve la classe pour cet onglet. Renvoie la fonction de libération, ou null si elle est déjà ouverte ailleurs. */
export async function lockClass(id: string): Promise<(() => void) | null> {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks?.request) return () => undefined;
    return new Promise(resolve => {
        locks.request(`envolees-class-${id}`, { ifAvailable: true }, lock => {
            if (!lock) { resolve(null); return undefined; }
            return new Promise<void>(release => resolve(() => release()));
        }).catch(() => resolve(() => undefined));
    });
}
