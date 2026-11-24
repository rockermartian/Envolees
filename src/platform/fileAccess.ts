// Accès aux fichiers de l'appareil, selon ce que permet le navigateur :
//   - Chrome / Edge sur ordinateur : File System Access API — un fichier ouvert peut rester « lié »
//     et être réécrit à chaque enregistrement, comme dans l'application de bureau ;
//   - autres navigateurs (Firefox, Safari, mobiles) : sélection de fichier classique, puis
//     téléchargement ou partage (feuille de partage du téléphone : Fichiers, Drive, e-mail…).

// Types minimaux (ces API ne sont pas encore dans la bibliothèque DOM de TypeScript).
interface PickerType { description: string; accept: Record<string, string[]> }
export interface LinkedFileHandle {
    kind: 'file';
    name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
    queryPermission?(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission?(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
    isSameEntry?(other: LinkedFileHandle): Promise<boolean>;
}
interface FsAccessWindow {
    showOpenFilePicker?(options: { types?: PickerType[]; multiple?: boolean; id?: string; excludeAcceptAllOption?: boolean }): Promise<LinkedFileHandle[]>;
    showSaveFilePicker?(options: { types?: PickerType[]; suggestedName?: string; id?: string }): Promise<LinkedFileHandle>;
}

const fsWindow = (): FsAccessWindow => window as unknown as FsAccessWindow;
const ENVOLEES_TYPE: PickerType = { description: 'Classe Envolées', accept: { 'application/x-envolees': ['.envolees'] } };

/** Fichiers « liés » (réécrits à chaque enregistrement) possibles dans ce navigateur. */
export const canLinkFiles = (): boolean =>
    typeof window !== 'undefined' && typeof fsWindow().showOpenFilePicker === 'function' && typeof fsWindow().showSaveFilePicker === 'function' && window.self === window.top;

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/** Sélection d'un fichier par un <input type="file"> (null si annulé). */
export function pickWithInput(accept?: string, capture?: 'environment' | 'user'): Promise<File | null> {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        if (accept) input.accept = accept;
        if (capture) input.setAttribute('capture', capture);
        input.style.display = 'none';
        let settled = false;
        const finish = (file: File | null) => {
            if (settled) return;
            settled = true;
            input.remove();
            window.removeEventListener('focus', onFocus);
            resolve(file);
        };
        // Annulation : évènement « cancel » (navigateurs récents), sinon retour du focus sans fichier.
        const onFocus = () => setTimeout(() => { if (!input.files?.length) finish(null); }, 1000);
        input.addEventListener('change', () => finish(input.files?.[0] ?? null));
        input.addEventListener('cancel', () => finish(null));
        window.addEventListener('focus', onFocus);
        document.body.appendChild(input);
        input.click();
    });
}

/** Écran tactile principal (tablette). */
export const isTouchDevice = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Choisit un fichier .envolees. `handle` est fourni quand le fichier pourra être réécrit. */
export async function pickEnvoleesFile(pickerId = 'envolees-classes'): Promise<{ file: File; handle?: LinkedFileHandle } | null> {
    if (canLinkFiles()) {
        try {
            const [handle] = await fsWindow().showOpenFilePicker!({ types: [ENVOLEES_TYPE], id: pickerId });
            return { file: await handle.getFile(), handle };
        } catch (error) {
            if (isAbort(error)) return null;
            console.warn('Sélecteur de fichiers indisponible, repli :', error);
        }
    }
    // Sur téléphone, un filtre sur une extension inconnue du système grise parfois le fichier : pas de filtre.
    const file = await pickWithInput(isTouchDevice() ? undefined : '.envolees');
    return file ? { file } : null;
}

/** Demande un emplacement pour un nouveau fichier lié (null si annulé ou impossible). */
export async function pickSaveLocation(suggestedName: string, pickerId = 'envolees-classes'): Promise<LinkedFileHandle | null> {
    if (!canLinkFiles()) return null;
    try {
        return await fsWindow().showSaveFilePicker!({ types: [ENVOLEES_TYPE], suggestedName, id: pickerId });
    } catch (error) {
        if (isAbort(error)) return null;
        throw error;
    }
}

/**
 * Vérifie (et si `ask`, demande) l'autorisation d'écrire dans un fichier lié.
 * La demande n'aboutit que pendant un geste de l'utilisateur (clic) ; sinon on renvoie false.
 */
export async function hasWritePermission(handle: LinkedFileHandle, ask: boolean): Promise<boolean> {
    try {
        if (!handle.queryPermission) return true;
        if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
        if (!ask || !handle.requestPermission) return false;
        return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
    } catch {
        return false;
    }
}

/** Écrit un fichier lié (le navigateur écrit dans un fichier temporaire puis remplace : écriture atomique). */
export async function writeLinkedFile(handle: LinkedFileHandle, blob: Blob): Promise<void> {
    const writable = await handle.createWritable();
    try {
        await writable.write(blob);
        await writable.close();
    } catch (error) {
        await writable.abort?.().catch(() => undefined);
        throw error;
    }
}

/** Téléchargement classique d'un fichier. */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Partage du fichier (téléphone : Fichiers, Drive, AirDrop, e-mail…) si le navigateur le permet. */
export function canShareFile(blob: Blob, fileName: string): boolean {
    try {
        return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
            && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/octet-stream' })] });
    } catch {
        return false;
    }
}

/** Partage ; renvoie false si l'utilisateur a annulé. */
export async function shareFile(blob: Blob, fileName: string, title: string): Promise<boolean> {
    try {
        await navigator.share({ files: [new File([blob], fileName, { type: 'application/octet-stream' })], title });
        return true;
    } catch (error) {
        if (isAbort(error)) return false;
        throw error;
    }
}

/** Lit un fichier image choisi par l'utilisateur en data URL (PNG, JPEG, WebP). */
export async function pickImageAsDataUrl(): Promise<string | { error: string } | null> {
    const file = await pickWithInput('image/png,image/jpeg,image/webp');
    if (!file) return null;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return { error: 'Format non pris en charge (PNG, JPEG ou WebP).' };
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve({ error: 'Lecture du fichier impossible.' });
        reader.readAsDataURL(file);
    });
}

/** Nom de fichier .envolees d'une classe. */
export const envoleesFileName = (name: string): string =>
    `${name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'classe'}.envolees`;
