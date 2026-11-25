// Base IndexedDB de la version web : tout ce qui, dans l'application de bureau, vit sur le disque.
//
//   images    clé = nom de fichier "<empreinte>.<ext>" → { blob, crc32 } ou { archive, start, size, crc32 }
//             (partagées entre classes)
//   archives  clé = id → fichier .envolees ouvert, rangé en un bloc (ses images en sont des tranches)
//   classes   clé = id → ClassRecord (data.json de la classe + liste de ses images)
//   backups   clé = id → copies de sécurité (data.json + images, comme userData/backups)
//   settings  clé = nom → valeur (dernière classe ouverte…)

const DB_NAME = 'envolees';
const DB_VERSION = 2; // 2 : magasin « archives »

export const STORES = { images: 'images', archives: 'archives', classes: 'classes', backups: 'backups', settings: 'settings' } as const;
type StoreName = typeof STORES[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error("Ce navigateur ne permet pas d'enregistrer des données (IndexedDB indisponible, navigation privée ?)."));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORES.images)) db.createObjectStore(STORES.images);
            if (!db.objectStoreNames.contains(STORES.archives)) db.createObjectStore(STORES.archives);
            if (!db.objectStoreNames.contains(STORES.classes)) db.createObjectStore(STORES.classes, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORES.backups)) {
                db.createObjectStore(STORES.backups, { keyPath: 'id' }).createIndex('classId', 'classId');
            }
            if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings);
        };
        request.onsuccess = () => {
            const db = request.result;
            // Une autre version de l'application (autre onglet) met la base à niveau : on libère.
            db.onversionchange = () => { db.close(); dbPromise = null; };
            resolve(db);
        };
        request.onerror = () => reject(request.error ?? new Error('Ouverture de la base impossible'));
        request.onblocked = () => reject(new Error("La base de données est bloquée par un autre onglet d'Envolées : fermez-le puis rechargez."));
    }).catch((error: unknown): never => { dbPromise = null; throw error; });
    return dbPromise;
}

export const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

/**
 * Exécute `work` dans une transaction et attend sa validation (les écritures sont alors durables).
 * `work` ne doit poser que des requêtes IndexedDB (pas d'attente d'autre chose : la transaction se fermerait).
 */
export async function transaction<T>(stores: StoreName[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
    const db = await openDb();
    const tx = db.transaction(stores, mode, { durability: 'strict' } as IDBTransactionOptions);
    const done = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Transaction IndexedDB en échec'));
        tx.onabort = () => reject(tx.error ?? new Error('Transaction IndexedDB annulée (espace de stockage plein ?)'));
    });
    const result = await work(tx);
    await done;
    return result;
}

export const getValue = <T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> =>
    transaction([store], 'readonly', tx => promisify(tx.objectStore(store).get(key) as IDBRequest<T | undefined>));

export const getAllValues = <T>(store: StoreName): Promise<T[]> =>
    transaction([store], 'readonly', tx => promisify(tx.objectStore(store).getAll() as IDBRequest<T[]>));

export const getSetting = <T>(key: string): Promise<T | undefined> => getValue<T>(STORES.settings, key);

export const setSetting = (key: string, value: unknown): Promise<void> =>
    transaction([STORES.settings], 'readwrite', tx => { tx.objectStore(STORES.settings).put(value, key); });
