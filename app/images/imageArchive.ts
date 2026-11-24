// Images dans les archives d'échange (.eleves, .competences, .atelier) :
// fichiers "images/<empreinte>.<ext>", octets copiés tels quels (jamais ré-encodés).
import type JSZip from 'jszip';
import { imageFileName, imageStore, isImageRef, mimeFromName } from './imageStore';

/**
 * Ajoute une image (référence ou data URL) à l'archive et renvoie son chemin "images/<nom>".
 * Une même image n'est écrite qu'une fois. Renvoie null si l'image est introuvable.
 */
export async function addImageToZip(zip: JSZip, src: string | null | undefined): Promise<string | null> {
    if (!src) return null;
    const ref = src.startsWith('data:') ? await imageStore.putDataUrl(src) : src;
    if (!ref || !isImageRef(ref)) return null;
    const path = `images/${imageFileName(ref)}`;
    if (!zip.file(path)) {
        const bytes = await imageStore.getBytes(ref);
        if (!bytes) return null;
        zip.file(path, bytes, { binary: true, compression: 'STORE' });
    }
    return path;
}

/**
 * Lit une image d'une archive importée (chemin "images/…" ou data URL),
 * la range dans le magasin et renvoie sa référence (null si absente ou illisible).
 */
export async function importImageFromZip(zip: JSZip | null, value: string | null | undefined): Promise<string | null> {
    if (!value) return null;
    if (value.startsWith('data:')) return imageStore.putDataUrl(value);
    const file = zip?.file(value);
    if (!file) return null;
    return imageStore.put(await file.async('uint8array'), mimeFromName(value));
}
