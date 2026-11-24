// Images des données.
//
// Dans AppData, une image est une **référence** `img:<empreinte>.<ext>` (début du SHA-256 de son
// contenu) : déduplication automatique, contenu immuable, jamais ré-encodé après l'import.
//
// Les octets ne vivent pas dans l'interface :
//   - application Electron : dans le processus principal (electron/classFile.js), affichés via
//     le protocole envolees-img://image/<nom> que Chromium charge à la demande ;
//   - tests (et repli hors Electron) : en mémoire, affichés via des URL blob.

export const IMAGE_REF_PREFIX = 'img:';
export const IMAGE_URL_SCHEME = 'envolees-img';

export const isImageRef = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith(IMAGE_REF_PREFIX);

/** Nom du fichier dans l'archive (`images/<nom>`) d'une référence. */
export const imageFileName = (ref: string): string => ref.slice(IMAGE_REF_PREFIX.length);

const MIME_BY_EXT: Record<string, string> = {
    webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml',
};
const EXT_BY_MIME: Record<string, string> = {
    'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg',
};

export const mimeFromName = (name: string): string =>
    MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
export const extFromMime = (mime: string): string => EXT_BY_MIME[mime] ?? 'bin';

const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');

/** Référence d'un contenu (même calcul que electron/classFile.js). */
export async function computeImageRef(bytes: Uint8Array, mime: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    return `${IMAGE_REF_PREFIX}${toHex(digest).slice(0, 32)}.${extFromMime(mime)}`;
}

/** Décode une data URL base64 (`data:image/png;base64,...`). */
export function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
    const match = /^data:([\w/+.-]+);base64,(.*)$/s.exec(dataUrl);
    if (!match) return null;
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime: match[1] };
}

export interface ImageBackend {
    /** Range un contenu et renvoie sa référence (identique si le contenu existe déjà). */
    put(bytes: Uint8Array, mime: string): Promise<string>;
    /** URL affichable d'une référence (null si inconnue). */
    url(ref: string): string | null;
    /** Octets d'une référence (exports). */
    getBytes(ref: string): Promise<Uint8Array | null>;
}

const electronUrl = (ref: string) => `${IMAGE_URL_SCHEME}://image/${encodeURIComponent(imageFileName(ref))}`;

const electronBackend: ImageBackend = {
    put: (bytes, mime) => window.electronAPI.putImage(bytes, mime),
    url: electronUrl,
    getBytes: async ref => {
        try {
            const response = await fetch(electronUrl(ref));
            return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
        } catch {
            return null;
        }
    },
};

/** Images en mémoire (tests, exécution hors Electron). */
export class MemoryImageBackend implements ImageBackend {
    private images = new Map<string, { bytes: Uint8Array; mime: string; url?: string }>();

    async put(bytes: Uint8Array, mime: string): Promise<string> {
        const ref = await computeImageRef(bytes, mime);
        if (!this.images.has(ref)) this.images.set(ref, { bytes, mime });
        return ref;
    }

    url(ref: string): string | null {
        const entry = this.images.get(ref);
        if (!entry) return null;
        entry.url ??= URL.createObjectURL(new Blob([entry.bytes as BlobPart], { type: entry.mime }));
        return entry.url;
    }

    async getBytes(ref: string): Promise<Uint8Array | null> {
        return this.images.get(ref)?.bytes ?? null;
    }
}

let backend: ImageBackend | null = null;
const currentBackend = (): ImageBackend =>
    (backend ??= typeof window !== 'undefined' && window.electronAPI?.putImage ? electronBackend : new MemoryImageBackend());

/** Remplace le stockage des images (tests). */
export const setImageBackend = (b: ImageBackend) => { backend = b; };

export const imageStore = {
    put: (bytes: Uint8Array, mime: string) => currentBackend().put(bytes, mime),
    putBlob: async (blob: Blob) => currentBackend().put(new Uint8Array(await blob.arrayBuffer()), blob.type || 'application/octet-stream'),
    /** Range une data URL telle quelle (sans ré-encodage). */
    putDataUrl: async (dataUrl: string): Promise<string | null> => {
        const decoded = decodeDataUrl(dataUrl);
        return decoded ? currentBackend().put(decoded.bytes, decoded.mime) : null;
    },
    url: (ref: string) => currentBackend().url(ref),
    getBytes: (ref: string) => currentBackend().getBytes(ref),
};
