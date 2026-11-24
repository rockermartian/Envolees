// Fichiers .envolees dans le navigateur, avec le même code de format que l'application de bureau
// (shared/envoleesArchive.js). Deux différences, pour tenir sur un téléphone :
//   - à l'ouverture, les images deviennent des tranches du fichier (Blob.slice) : aucune copie ;
//   - à l'écriture, l'archive est un Blob composé des images déjà stockées : aucune image n'est relue.
import { buildArchive, readArchive } from '../../app/shared/envoleesArchive.js';
import { mimeFromName } from '../../app/images/imageStore';

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> =>
    new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());

export const deflateRaw = (bytes: Uint8Array) => pipe(bytes, new CompressionStream('deflate-raw'));
export const inflateRaw = (bytes: Uint8Array) => pipe(bytes, new DecompressionStream('deflate-raw'));

export interface ArchiveImageBlob {
    name: string;   // "<empreinte>.<ext>"
    blob: Blob;
    crc32: number;
}

/** Lit un fichier .envolees (erreurs : ArchiveError de shared/envoleesArchive.js, messages en français). */
export async function readEnvoleesFile(file: Blob): Promise<{ dataJson: string; images: ArchiveImageBlob[] }> {
    const buffer = await file.arrayBuffer();
    const buf = new Uint8Array(buffer);
    const { dataJson, images } = await readArchive(buf, inflateRaw);
    const result: ArchiveImageBlob[] = [];
    for (const [name, { bytes, crc32 }] of images) {
        const type = mimeFromName(name);
        // Image stockée telle quelle : vue sur le fichier → tranche du fichier d'origine.
        const blob = bytes.buffer === buffer
            ? file.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength, type)
            : new Blob([bytes as BlobPart], { type });
        result.push({ name, blob, crc32 });
    }
    return { dataJson, images: result };
}

/**
 * Construit un fichier .envolees. Les images sont passées par leur Blob (taille et CRC-32 connus) :
 * buildArchive ne lit que `length` des données d'une entrée, on lui donne donc un substitut
 * remplacé par le Blob dans la liste des morceaux.
 */
export async function buildEnvoleesBlob(dataJson: string, images: ArchiveImageBlob[], appVersion: string): Promise<Blob> {
    const placeholders = new Map<object, Blob>();
    const archiveImages = images.map(image => {
        const standIn = { length: image.blob.size };
        placeholders.set(standIn, image.blob);
        return { name: image.name, bytes: standIn as unknown as Uint8Array, crc32: image.crc32 };
    });
    const { parts } = await buildArchive({ dataJson, images: archiveImages, appVersion, deflateRaw });
    return new Blob(parts.map(part => placeholders.get(part) ?? (part as BlobPart)), { type: 'application/octet-stream' });
}
