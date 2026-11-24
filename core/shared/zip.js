// Lecture et écriture ZIP minimales, sans dépendance (Node et navigateur).
//
// Pourquoi pas JSZip ici : les fichiers de classe contiennent des milliers de photos
// stockées sans compression (STORE). On veut
//   - à la lecture : accéder aux octets d'une entrée par simple vue (subarray), sans copie ;
//   - à l'écriture : produire une liste de morceaux à écrire tels quels sur le disque,
//     sans construire un tampon géant, en réutilisant les CRC-32 déjà connus.
// Pas de ZIP64 : au plus 65 535 entrées et 4 Go, très au-delà d'une classe réelle.

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const FLAG_UTF8 = 0x0800;
export const METHOD_STORE = 0;
export const METHOD_DEFLATE = 8;

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

/** CRC-32 (polynôme ZIP) d'un tableau d'octets. */
export function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function dosDateTime(date) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
}

/**
 * @typedef {Object} ZipEntryInput
 * @property {string} name           Chemin dans l'archive
 * @property {Uint8Array} data       Octets tels qu'écrits (déjà compressés si method = DEFLATE)
 * @property {number} method         METHOD_STORE ou METHOD_DEFLATE
 * @property {number} crc32          CRC-32 des octets NON compressés
 * @property {number} size           Taille NON compressée
 */

/**
 * Construit une archive sous forme de morceaux à écrire dans l'ordre.
 * Les octets des entrées ne sont pas copiés.
 * @param {ZipEntryInput[]} entries
 * @returns {{ parts: Uint8Array[], length: number }}
 */
export function buildZip(entries, date = new Date()) {
    if (entries.length > 0xfffe) throw new Error('Archive trop volumineuse (nombre de fichiers).');
    const { time, day } = dosDateTime(date);
    const parts = [];
    const central = [];
    let offset = 0;

    for (const e of entries) {
        const name = encoder.encode(e.name);
        const local = new Uint8Array(30 + name.length);
        const v = new DataView(local.buffer);
        v.setUint32(0, SIG_LOCAL, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, FLAG_UTF8, true);
        v.setUint16(8, e.method, true);
        v.setUint16(10, time, true);
        v.setUint16(12, day, true);
        v.setUint32(14, e.crc32 >>> 0, true);
        v.setUint32(18, e.data.length, true);
        v.setUint32(22, e.size, true);
        v.setUint16(26, name.length, true);
        v.setUint16(28, 0, true);
        local.set(name, 30);

        const cd = new Uint8Array(46 + name.length);
        const w = new DataView(cd.buffer);
        w.setUint32(0, SIG_CENTRAL, true);
        w.setUint16(4, 20, true);
        w.setUint16(6, 20, true);
        w.setUint16(8, FLAG_UTF8, true);
        w.setUint16(10, e.method, true);
        w.setUint16(12, time, true);
        w.setUint16(14, day, true);
        w.setUint32(16, e.crc32 >>> 0, true);
        w.setUint32(20, e.data.length, true);
        w.setUint32(24, e.size, true);
        w.setUint16(28, name.length, true);
        w.setUint32(42, offset, true);
        cd.set(name, 46);
        central.push(cd);

        parts.push(local, e.data);
        offset += local.length + e.data.length;
        if (offset > 0xffffffff) throw new Error('Archive trop volumineuse (plus de 4 Go).');
    }

    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const x = new DataView(end.buffer);
    x.setUint32(0, SIG_END, true);
    x.setUint16(8, entries.length, true);
    x.setUint16(10, entries.length, true);
    x.setUint32(12, cdSize, true);
    x.setUint32(16, offset, true);

    parts.push(...central, end);
    return { parts, length: offset + cdSize + end.length };
}

/**
 * @typedef {Object} ZipIndexEntry
 * @property {number} method
 * @property {number} crc32
 * @property {number} compressedSize
 * @property {number} size
 * @property {number} dataStart       Position des octets de l'entrée dans l'archive
 */

/**
 * Lit le répertoire central d'une archive.
 * @param {Uint8Array} buf
 * @returns {Map<string, ZipIndexEntry>}
 */
export function readZipIndex(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let endPos = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
        if (view.getUint32(i, true) === SIG_END) { endPos = i; break; }
    }
    if (endPos < 0) throw new Error('Archive ZIP introuvable');

    const count = view.getUint16(endPos + 10, true);
    let p = view.getUint32(endPos + 16, true);
    const index = new Map();
    for (let i = 0; i < count; i++) {
        if (view.getUint32(p, true) !== SIG_CENTRAL) throw new Error('Répertoire ZIP endommagé');
        const method = view.getUint16(p + 10, true);
        const crc = view.getUint32(p + 16, true);
        const compressedSize = view.getUint32(p + 20, true);
        const size = view.getUint32(p + 24, true);
        const nameLen = view.getUint16(p + 28, true);
        const extraLen = view.getUint16(p + 30, true);
        const commentLen = view.getUint16(p + 32, true);
        const localOffset = view.getUint32(p + 42, true);
        const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
        p += 46 + nameLen + extraLen + commentLen;

        if (view.getUint32(localOffset, true) !== SIG_LOCAL) throw new Error('Entrée ZIP endommagée : ' + name);
        const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
        if (dataStart + compressedSize > buf.length) throw new Error('Archive ZIP tronquée');
        index.set(name, { method, crc32: crc, compressedSize, size, dataStart });
    }
    return index;
}

/** Octets bruts (éventuellement compressés) d'une entrée : vue sans copie. */
export const entryBytes = (buf, entry) => buf.subarray(entry.dataStart, entry.dataStart + entry.compressedSize);
