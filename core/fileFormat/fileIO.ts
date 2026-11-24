// Données ⇄ fichier de classe, côté interface.
// L'archive elle-même est lue et écrite par le processus principal (electron/classFile.js,
// format décrit dans shared/envoleesArchive.js) : l'interface ne manipule que data.json.
import { AppData } from '../types';
import { decodeDataUrl, imageStore, isImageRef } from '../images/imageStore';
import { forEachImage, mapImagesAsync } from './imageFields';
import { normalizeAppData, sparseSkills } from './normalize';

/** Références d'images utilisées par les données. */
export function collectImageRefs(data: AppData): string[] {
    const refs = new Set<string>();
    forEachImage(data, value => { if (isImageRef(value)) refs.add(value); });
    return [...refs];
}

/**
 * Remplace les images encore en data URL par des références (octets conservés tels quels,
 * sans ré-encodage). Renvoie l'objet d'origine s'il n'y a rien à convertir.
 */
export async function internInlineImages(data: AppData, put: (bytes: Uint8Array, mime: string) => Promise<string>): Promise<AppData> {
    let hasInline = false;
    forEachImage(data, value => { if (value.startsWith('data:')) hasInline = true; });
    if (!hasInline) return data;
    return mapImagesAsync(data, async value => {
        if (!value.startsWith('data:')) return value;
        const decoded = decodeDataUrl(value);
        return decoded ? put(decoded.bytes, decoded.mime) : null;
    });
}

/** Contenu à enregistrer : data.json (acquisitions creuses) et images référencées. */
export async function prepareForSave(data: AppData): Promise<{ dataJson: string; refs: string[] }> {
    const stored = await internInlineImages(data, imageStore.put);
    const sparse: AppData = { ...stored, students: stored.students.map(s => ({ ...s, skills: sparseSkills(s.skills) })) };
    return { dataJson: JSON.stringify(sparse), refs: collectImageRefs(sparse) };
}

/** Données lues dans un fichier, complétées et mises à niveau. */
export const parseOpenedData = (dataJson: string): AppData => normalizeAppData(JSON.parse(dataJson));
