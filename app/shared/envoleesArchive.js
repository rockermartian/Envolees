// Format de fichier .envolees — schéma 2 (partagé : processus principal Electron, tests, future version web).
//
//   ma-classe.envolees            (archive ZIP)
//   ├── manifest.json             {"format":"envolees","schema":2,"app":"…","savedAt":"…"}
//   ├── data.json                 DEFLATE — toutes les données, sans aucune image
//   └── images/<empreinte>.<ext>  STORE — octets bruts, jamais recompressés
//
// Dans data.json, une image est une référence "img:<empreinte>.<ext>", où l'empreinte est
// le début du SHA-256 de son contenu (déduplication automatique, contenu immuable).

import { buildZip, crc32, entryBytes, readZipIndex, METHOD_DEFLATE, METHOD_STORE } from './zip.js';

export const FILE_FORMAT = 'envolees';
export const FILE_SCHEMA = 2;
export const IMAGES_DIR = 'images/';

export class ArchiveError extends Error {
    /** @param {'not-archive'|'old-format'|'not-envolees'|'too-recent'|'damaged'} code */
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * @typedef {Object} ArchiveImage
 * @property {string} name       Nom du fichier image (sans "images/")
 * @property {Uint8Array} bytes
 * @property {number} [crc32]    CRC-32 déjà connu (évite de le recalculer)
 */

/**
 * Construit l'archive (morceaux à écrire dans l'ordre, sans copie des images).
 * @param {{ dataJson: string, images: ArchiveImage[], appVersion: string,
 *           deflateRaw: (bytes: Uint8Array) => Promise<Uint8Array> }} input
 */
export async function buildArchive({ dataJson, images, appVersion, deflateRaw }) {
    const manifest = encoder.encode(JSON.stringify({ format: FILE_FORMAT, schema: FILE_SCHEMA, app: appVersion, savedAt: new Date().toISOString() }));
    const json = encoder.encode(dataJson);
    const entries = [
        { name: 'manifest.json', data: manifest, method: METHOD_STORE, crc32: crc32(manifest), size: manifest.length },
        { name: 'data.json', data: await deflateRaw(json), method: METHOD_DEFLATE, crc32: crc32(json), size: json.length },
        ...images.map(img => ({
            name: IMAGES_DIR + img.name,
            data: img.bytes,
            method: METHOD_STORE,
            crc32: img.crc32 ?? crc32(img.bytes),
            size: img.bytes.length,
        })),
    ];
    return buildZip(entries);
}

/**
 * Lit une archive .envolees.
 * Les images renvoyées sont des vues sur `buf` (aucune copie) : garder `buf` en mémoire.
 * @param {Uint8Array} buf
 * @param {(bytes: Uint8Array) => Promise<Uint8Array>} inflateRaw
 * @returns {Promise<{ manifest: object, dataJson: string, images: Map<string, { bytes: Uint8Array, crc32: number }> }>}
 */
export async function readArchive(buf, inflateRaw) {
    let index;
    try {
        index = readZipIndex(buf);
    } catch {
        throw new ArchiveError('not-archive', "Ce fichier n'est pas un fichier de classe Envolées (archive illisible).");
    }

    const read = async name => {
        const entry = index.get(name);
        if (!entry) return null;
        const raw = entryBytes(buf, entry);
        if (entry.method === METHOD_STORE) return raw;
        if (entry.method === METHOD_DEFLATE) return inflateRaw(raw);
        throw new ArchiveError('damaged', `Compression non prise en charge pour ${name}.`);
    };

    const manifestBytes = await read('manifest.json');
    if (!manifestBytes) {
        throw new ArchiveError(index.has('data.json') ? 'old-format' : 'not-envolees',
            index.has('data.json')
                ? "Ce fichier a été créé par une ancienne version de test d'Envolées et ne peut plus être ouvert."
                : "Ce fichier n'est pas un fichier de classe Envolées.");
    }
    let manifest;
    try { manifest = JSON.parse(decoder.decode(manifestBytes)); } catch { manifest = null; }
    if (!manifest || manifest.format !== FILE_FORMAT || typeof manifest.schema !== 'number') {
        throw new ArchiveError('not-envolees', "Ce fichier n'est pas un fichier de classe Envolées.");
    }
    if (manifest.schema > FILE_SCHEMA) {
        throw new ArchiveError('too-recent', "Ce fichier a été créé par une version plus récente d'Envolées. Mettez l'application à jour pour l'ouvrir.");
    }

    const dataBytes = await read('data.json');
    if (!dataBytes) throw new ArchiveError('damaged', 'Les données du fichier sont absentes.');
    let dataJson;
    try {
        dataJson = decoder.decode(dataBytes);
        JSON.parse(dataJson);
    } catch {
        throw new ArchiveError('damaged', 'Les données du fichier sont endommagées.');
    }

    const images = new Map();
    for (const [name, entry] of index) {
        if (!name.startsWith(IMAGES_DIR) || name.length === IMAGES_DIR.length) continue;
        const bytes = entry.method === METHOD_STORE ? entryBytes(buf, entry) : await read(name);
        images.set(name.slice(IMAGES_DIR.length), { bytes, crc32: entry.crc32 });
    }
    return { manifest, dataJson, images };
}
