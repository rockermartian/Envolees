// Fichier d'échange d'élèves (.eleves) : archive ZIP
//   students.json   élèves (acquisitions creuses ; images = chemins "images/…")
//   skills.json     compétences acquises par ces élèves (pour les retrouver dans une autre classe)
//   images/         photos (octets copiés tels quels)
// L'ancien format (tableau JSON d'élèves, sans images) reste lisible.
import JSZip from 'jszip';
import { Domain, SchoolProgram, Student } from '../types';
import { addImageToZip, importImageFromZip } from '../images/imageArchive';
import { mapProgramImages } from './imageFields';
import { normalizePrograms, sparseSkills } from './normalize';

/** Programmes réduits aux compétences acquises par ces élèves. */
const acquiredProgramsOf = (programs: SchoolProgram[], students: Student[]): SchoolProgram[] => {
    const acquired = new Set(students.flatMap(s => Object.keys(s.skills)));
    const keep = (ds: Domain[]): Domain[] => ds.reduce((acc, d) => {
        const skills = d.skills.filter(s => acquired.has(s.id));
        const subDomains = keep(d.subDomains ?? []);
        if (skills.length || subDomains.length) acc.push({ ...d, skills, subDomains });
        return acc;
    }, [] as Domain[]);
    return programs.reduce((acc, p) => {
        const domains = keep(p.domains);
        if (domains.length) acc.push({ ...p, domains });
        return acc;
    }, [] as SchoolProgram[]);
};

const skillImages = (programs: SchoolProgram[]): string[] => {
    const out = new Set<string>();
    const walk = (ds: Domain[]) => ds.forEach(d => { d.skills.forEach(sk => { if (sk.image) out.add(sk.image); }); walk(d.subDomains ?? []); });
    programs.forEach(p => walk(p.domains));
    return [...out];
};

/** Octets d'un fichier .eleves pour ces élèves. */
export async function buildStudentsArchive(students: Student[], programs: SchoolProgram[]): Promise<Uint8Array> {
    const zip = new JSZip();
    const toZip = (value: string | null | undefined) => addImageToZip(zip, value);

    const exported: Student[] = [];
    for (const student of students) {
        const skills = sparseSkills(student.skills);
        for (const [skillId, details] of Object.entries(skills)) {
            if (details.photo) skills[skillId] = { ...details, photo: await toZip(details.photo) };
        }
        exported.push({ ...student, photo: await toZip(student.photo), skills });
    }
    zip.file('students.json', JSON.stringify(exported, null, 2));

    const acquiredPrograms = acquiredProgramsOf(programs, exported);
    const paths = new Map<string, string | null>();
    for (const value of skillImages(acquiredPrograms)) paths.set(value, await toZip(value));
    zip.file('skills.json', JSON.stringify(mapProgramImages(acquiredPrograms, value => paths.get(value) ?? null), null, 2));

    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/**
 * Lit un fichier .eleves : élèves (images rangées dans le magasin, acquisitions creuses) et
 * programmes associés (normalisés). Ancien format JSON : de nouveaux identifiants sont attribués.
 */
export async function readStudentsArchive(buffer: ArrayBuffer, newId: () => string = () => crypto.randomUUID()): Promise<{ students: Student[]; programs: SchoolProgram[] }> {
    const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
    const isZip = head[0] === 0x50 && head[1] === 0x4B;
    let students: Student[];
    let programs: SchoolProgram[] = [];
    let zip: JSZip | null = null;

    if (isZip) {
        zip = await JSZip.loadAsync(buffer);
        const studentsFile = zip.file('students.json');
        if (!studentsFile) throw new Error("students.json manquant dans l'archive");
        students = JSON.parse(await studentsFile.async('string'));
        const skillsFile = zip.file('skills.json');
        if (skillsFile) programs = JSON.parse(await skillsFile.async('string'));
    } else {
        students = JSON.parse(new TextDecoder().decode(buffer));
        if (!Array.isArray(students)) throw new Error('Format invalide');
        students = students.map(s => ({ ...s, id: newId() }));
    }
    if (!Array.isArray(students)) throw new Error('Format invalide');

    const restore = (value: string | null | undefined) => importImageFromZip(zip, value);
    const restored: Student[] = [];
    for (const s of students) {
        const skills = sparseSkills(s.skills);
        for (const [id, details] of Object.entries(skills)) {
            if (details.photo) skills[id] = { ...details, photo: await restore(details.photo) };
        }
        restored.push({ ...s, photo: await restore(s.photo), skills });
    }

    const normalized = normalizePrograms(Array.isArray(programs) ? programs : []);
    const paths = new Map<string, string | null>();
    for (const value of skillImages(normalized)) paths.set(value, await restore(value));
    return { students: restored, programs: mapProgramImages(normalized, value => paths.get(value) ?? null) };
}
