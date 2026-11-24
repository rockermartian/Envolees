import { AppData, Domain, SchoolProgram } from '../types';

// Parcours de tous les champs image d'AppData :
//   élève (photo), acquisitions (photo de preuve), signatures, ateliers, compétences (illustration).

type ImageValue = string | null | undefined;

/** Appelle `visit` pour chaque champ image non vide. */
export function forEachImage(data: AppData, visit: (value: string) => void): void {
    const v = (value: ImageValue) => { if (value) visit(value); };
    data.students.forEach(s => {
        v(s.photo);
        Object.values(s.skills ?? {}).forEach(d => v(d?.photo));
    });
    v(data.teacherConfig?.teacherSignature);
    v(data.teacherConfig?.teacher2Signature);
    v(data.teacherConfig?.directorSignature);
    data.workshops.forEach(w => v(w.image));
    const walk = (d: Domain) => { d.skills?.forEach(sk => v(sk.image)); d.subDomains?.forEach(walk); };
    data.schoolPrograms.forEach(p => p.domains?.forEach(walk));
}

export const mapProgramImages = (programs: SchoolProgram[], map: (value: string) => ImageValue): SchoolProgram[] => {
    const walk = (d: Domain): Domain => ({
        ...d,
        skills: (d.skills ?? []).map(sk => (sk.image ? { ...sk, image: map(sk.image) ?? null } : sk)),
        subDomains: (d.subDomains ?? []).map(walk),
    });
    return programs.map(p => ({ ...p, domains: (p.domains ?? []).map(walk) }));
};

/**
 * Renvoie une copie d'AppData où chaque champ image non vide est remplacé par `map(valeur)`.
 * (Les objets sans image sont recopiés superficiellement ; l'original n'est pas modifié.)
 */
export function mapImages(data: AppData, map: (value: string) => ImageValue): AppData {
    const m = (value: ImageValue) => (value ? map(value) ?? null : value);
    return {
        ...data,
        students: data.students.map(s => ({
            ...s,
            photo: m(s.photo) ?? null,
            skills: Object.fromEntries(Object.entries(s.skills ?? {}).map(([id, d]) =>
                [id, d?.photo ? { ...d, photo: m(d.photo) } : d])),
        })),
        teacherConfig: {
            ...data.teacherConfig,
            teacherSignature: m(data.teacherConfig?.teacherSignature) ?? null,
            teacher2Signature: m(data.teacherConfig?.teacher2Signature),
            directorSignature: m(data.teacherConfig?.directorSignature),
        },
        workshops: data.workshops.map(w => ({ ...w, image: m(w.image) ?? null })),
        schoolPrograms: mapProgramImages(data.schoolPrograms, map),
    };
}

/** Version asynchrone : `resolve` est appelé une fois par valeur distincte. */
export async function mapImagesAsync(data: AppData, resolve: (value: string) => Promise<ImageValue>): Promise<AppData> {
    const distinct = new Set<string>();
    forEachImage(data, value => distinct.add(value));
    const resolved = new Map<string, ImageValue>();
    for (const value of distinct) resolved.set(value, await resolve(value));
    return mapImages(data, value => resolved.get(value));
}
