// Images des classes dans le navigateur : équivalent de la partie « images » d'electron/classFile.js.
//
// Les octets sont rangés une fois dans IndexedDB (Blob, avec leur CRC-32 pour l'écriture des archives).
// L'interface ne manipule que des références `img:<empreinte>.<ext>` ; pour l'affichage, chaque image
// chargée reçoit une URL blob, créée à la demande. Les Blob relus depuis IndexedDB sont adossés au
// stockage du navigateur : charger une classe de 4 000 photos ne les met pas en mémoire.
import { crc32 } from '../../../shared/zip.js';
import { computeImageRef, imageFileName, mimeFromName, type ImageBackend } from '../../../images/imageStore';
import { STORES, promisify, transaction } from './db';

export interface StoredImageEntry {
    blob: Blob;
    crc32: number;
    /** Date de rangement (ms) : protège les images récentes du ménage. */
    addedAt?: number;
}

export class WebImageBackend implements ImageBackend {
    private entries = new Map<string, StoredImageEntry>();
    private urls = new Map<string, string>();

    async put(bytes: Uint8Array, mime: string): Promise<string> {
        const ref = await computeImageRef(bytes, mime);
        const name = imageFileName(ref);
        if (!this.entries.has(name)) {
            const entry = { blob: new Blob([bytes as BlobPart], { type: mime }), crc32: crc32(bytes), addedAt: Date.now() };
            await transaction([STORES.images], 'readwrite', tx => { tx.objectStore(STORES.images).put(entry, name); });
            this.entries.set(name, entry);
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
        const entry = this.entries.get(imageFileName(ref)) ?? (await this.load([imageFileName(ref)]), this.entries.get(imageFileName(ref)));
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
        const found = await transaction([STORES.images], 'readonly', tx => {
            const store = tx.objectStore(STORES.images);
            return Promise.all(wanted.map(name => promisify(store.get(name) as IDBRequest<StoredImageEntry | undefined>)));
        });
        const missing: string[] = [];
        found.forEach((entry, i) => {
            if (entry?.blob) this.entries.set(wanted[i], { blob: retype(entry.blob, wanted[i]), crc32: entry.crc32 });
            else missing.push(wanted[i]);
        });
        return missing;
    }

    /**
     * Range des images venant d'un fichier ouvert (Blob = tranches du fichier, sans copie en mémoire).
     * Les images déjà connues ne sont pas réécrites.
     */
    async storeMany(images: { name: string; blob: Blob; crc32: number }[]): Promise<void> {
        if (images.length === 0) return;
        // Par lots : une transaction géante peut échouer sur certains navigateurs mobiles.
        const BATCH = 200;
        for (let i = 0; i < images.length; i += BATCH) {
            const batch = images.slice(i, i + BATCH);
            await transaction([STORES.images], 'readwrite', tx => {
                const store = tx.objectStore(STORES.images);
                for (const image of batch) {
                    const request = store.getKey(image.name);
                    request.onsuccess = () => {
                        if (request.result === undefined) store.put({ blob: image.blob, crc32: image.crc32, addedAt: Date.now() }, image.name);
                    };
                }
            });
        }
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
}

/** Certains navigateurs perdent le type MIME des Blob relus : il est déduit du nom. */
const retype = (blob: Blob, name: string): Blob =>
    blob.type ? blob : blob.slice(0, blob.size, mimeFromName(name));

export const webImages = new WebImageBackend();
