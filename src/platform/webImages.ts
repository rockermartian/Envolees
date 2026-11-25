// Images des classes dans le navigateur : équivalent de la partie « images » d'electron/classFile.js.
//
// Deux façons de ranger une image dans IndexedDB :
//   - une image ajoutée dans l'application (photo, illustration) : son propre Blob ;
//   - les images d'un fichier .envolees ouvert : le fichier entier est rangé UNE fois (magasin
//     « archives »), et chaque image n'est qu'une tranche de ce fichier (début, taille).
//     Ranger 2 000 photos une par une prend des dizaines de secondes, voire davantage, sur iPad
//     (moteur de Safari) ou sur un PC dont l'antivirus inspecte chaque fichier écrit par le navigateur ;
//     une seule écriture prend le temps de copier le fichier.
// L'interface ne manipule que des références `img:<empreinte>.<ext>` ; pour l'affichage, chaque image
// chargée reçoit une URL blob, créée à la demande. Les Blob relus depuis IndexedDB sont adossés au
// stockage du navigateur : rien n'est mis en mémoire.
import { crc32 } from '../../app/shared/zip.js';
import { computeImageRef, imageFileName, mimeFromName, type ImageBackend } from '../../app/images/imageStore';
import { STORES, promisify, transaction } from './db';

/** Image prête à afficher ou à écrire dans une archive. */
export interface StoredImageEntry {
    blob: Blob;
    crc32: number;
}

/** Enregistrement IndexedDB d'une image (magasin « images »). */
export type ImageRecord =
    | { blob: Blob; crc32: number; addedAt?: number }
    | { archive: string; start: number; size: number; crc32: number; addedAt?: number };

/** Image d'un fichier ouvert : tranche [start, start + size[ du fichier, ou Blob à part (image compressée). */
export interface ArchivedImage {
    name: string;
    crc32: number;
    start?: number;
    size?: number;
    blob: Blob;
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export class WebImageBackend implements ImageBackend {
    private entries = new Map<string, StoredImageEntry>();
    private urls = new Map<string, string>();
    /** Fichiers rangés (relus une fois, puis découpés). */
    private archives = new Map<string, Blob>();

    async put(bytes: Uint8Array, mime: string): Promise<string> {
        const ref = await computeImageRef(bytes, mime);
        const name = imageFileName(ref);
        if (!this.entries.has(name)) {
            const record: ImageRecord = { blob: new Blob([bytes as BlobPart], { type: mime }), crc32: crc32(bytes), addedAt: Date.now() };
            await transaction([STORES.images], 'readwrite', tx => { tx.objectStore(STORES.images).put(record, name); });
            this.entries.set(name, { blob: record.blob, crc32: record.crc32 });
        }
        return ref;
    }

    url(ref: string): string | null {
        const name = imageFileName(ref);
        const cached = this.urls.get(name);
        if (cached) return cached;
        const entry = this.entries.get(name);
        if (!entry) return null;
        const url = URL.createObjectURL(entry.blob);
        this.urls.set(name, url);
        return url;
    }

    async getBytes(ref: string): Promise<Uint8Array | null> {
        const name = imageFileName(ref);
        if (!this.entries.has(name)) await this.load([name]);
        const entry = this.entries.get(name);
        return entry ? new Uint8Array(await entry.blob.arrayBuffer()) : null;
    }

    /** Image déjà chargée (nom de fichier). */
    entry(name: string): StoredImageEntry | undefined {
        return this.entries.get(name);
    }

    /** Charge depuis IndexedDB les images de ces noms (avant d'afficher une classe). Renvoie les noms introuvables. */
    async load(names: Iterable<string>): Promise<string[]> {
        const wanted = [...new Set(names)].filter(name => !this.entries.has(name));
        if (wanted.length === 0) return [];
        const { records, archives } = await transaction([STORES.images, STORES.archives], 'readonly', async tx => {
            const images = tx.objectStore(STORES.images);
            const found = await Promise.all(wanted.map(name => promisify(images.get(name) as IDBRequest<ImageRecord | undefined>)));
            const ids = [...new Set(found.flatMap(r => (r && 'archive' in r && !this.archives.has(r.archive) ? [r.archive] : [])))];
            const store = tx.objectStore(STORES.archives);
            const blobs = await Promise.all(ids.map(id => promisify(store.get(id) as IDBRequest<Blob | undefined>)));
            return { records: found, archives: new Map(ids.map((id, i) => [id, blobs[i]])) };
        });
        archives.forEach((blob, id) => { if (blob) this.archives.set(id, blob); });
        const missing: string[] = [];
        records.forEach((record, i) => {
            const name = wanted[i];
            if (record && 'archive' in record) {
                const archive = this.archives.get(record.archive);
                if (archive) this.entries.set(name, { blob: archive.slice(record.start, record.start + record.size, mimeFromName(name)), crc32: record.crc32 });
                else missing.push(name);
            } else if (record && 'blob' in record && record.blob) {
                this.entries.set(name, { blob: retype(record.blob, name), crc32: record.crc32 });
            } else {
                missing.push(name);
            }
        });
        return missing;
    }

    /**
     * Range les images d'un fichier .envolees ouvert : le fichier en une seule écriture, puis pour
     * chaque image nouvelle, sa position dans le fichier. Les images déjà connues ne sont pas réécrites.
     */
    async storeArchive(file: Blob, images: ArchivedImage[]): Promise<void> {
        if (images.length === 0) return;
        const id = newId();
        let used = false;
        await transaction([STORES.images, STORES.archives], 'readwrite', tx => {
            tx.objectStore(STORES.archives).put(file.slice(0, file.size, 'application/octet-stream'), id);
            const store = tx.objectStore(STORES.images);
            const addedAt = Date.now();
            for (const image of images) {
                const request = store.getKey(image.name);
                request.onsuccess = () => {
                    if (request.result !== undefined) return;
                    const record: ImageRecord = image.start !== undefined && image.size !== undefined
                        ? { archive: id, start: image.start, size: image.size, crc32: image.crc32, addedAt }
                        : { blob: image.blob, crc32: image.crc32, addedAt };
                    if ('archive' in record) used = true;
                    store.put(record, image.name);
                };
            }
        });
        // Toutes les images étaient déjà là (même classe rouverte) : le fichier rangé ne sert à rien.
        if (!used) await transaction([STORES.archives], 'readwrite', tx => { tx.objectStore(STORES.archives).delete(id); });
        // Les Blob gardés pour l'affichage sont ceux du navigateur, plus ceux du fichier d'origine.
        for (const image of images) this.forget(image.name);
        await this.load(images.map(image => image.name));
    }

    /** Oublie une image (supprimée de la base). */
    forget(name: string): void {
        const url = this.urls.get(name);
        if (url) URL.revokeObjectURL(url);
        this.urls.delete(name);
        this.entries.delete(name);
    }

    /** Oublie un fichier rangé (supprimé de la base). */
    forgetArchive(id: string): void {
        this.archives.delete(id);
    }
}

/** Certains navigateurs perdent le type MIME des Blob relus : il est déduit du nom. */
const retype = (blob: Blob, name: string): Blob =>
    blob.type ? blob : blob.slice(0, blob.size, mimeFromName(name));

export const webImages = new WebImageBackend();
