// Calculs de l'interface mobile (fonctions pures, testées) : lecture du programme et des acquisitions.
// Les modifications passent toutes par les modules métier de l'application (domain/…).
import { isAcquired } from '../../core/domain/acquisitions';
import { eventDay } from '../../core/domain/workshops';
import type { AppData, Domain, SchoolProgram, Skill, Student, Workshop, WorkshopEvent } from '../../core/types';

/** Programmes activés (comme l'application de bureau). */
export const activePrograms = (data: AppData): SchoolProgram[] => data.schoolPrograms.filter(p => p.enabled !== false);

export interface FlatSkill {
    skill: Skill;
    programId: string;
    /** Noms des domaines, du plus large au plus précis. */
    path: string[];
}

export function flattenSkills(programs: SchoolProgram[]): FlatSkill[] {
    const out: FlatSkill[] = [];
    const walk = (programId: string, domain: Domain, path: string[]) => {
        const here = [...path, domain.name];
        domain.skills.forEach(skill => out.push({ skill, programId, path: here }));
        (domain.subDomains ?? []).forEach(sub => walk(programId, sub, here));
    };
    programs.forEach(p => p.domains.forEach(d => walk(p.id, d, [])));
    return out;
}

/** Toutes les compétences d'un domaine (sous-domaines compris). */
export function domainSkillIds(domain: Domain): string[] {
    return [...domain.skills.map(s => s.id), ...(domain.subDomains ?? []).flatMap(domainSkillIds)];
}

export const countAcquired = (student: Student, skillIds: Iterable<string>): number => {
    let n = 0;
    for (const id of skillIds) if (isAcquired(student.skills[id])) n++;
    return n;
};

/** Texte comparable : minuscules, sans accents ni espaces superflus. */
export const fold = (text: string): string =>
    text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Tous les mots de la recherche figurent dans le texte (ordre indifférent). */
export const matchesQuery = (query: string, ...texts: (string | undefined)[]): boolean => {
    const words = fold(query).split(' ').filter(Boolean);
    if (words.length === 0) return true;
    const haystack = fold(texts.filter(Boolean).join(' '));
    return words.every(w => haystack.includes(w));
};

/** Ordre d'affichage des élèves : prénom, puis nom. */
export const sortStudents = (students: Student[]): Student[] =>
    [...students].sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr') || a.lastName.localeCompare(b.lastName, 'fr'));

export const studentName = (s: Pick<Student, 'firstName' | 'lastName'>) => `${s.firstName} ${s.lastName}`.trim();

/**
 * Prénom affiché seul (tuiles, mode élève), complété de l'initiale du nom quand plusieurs élèves
 * portent le même prénom (« Tom L. », « Tom V. »).
 */
export function shortNames(students: Pick<Student, 'id' | 'firstName' | 'lastName'>[]): Map<string, string> {
    const counts = new Map<string, number>();
    students.forEach(s => counts.set(fold(s.firstName), (counts.get(fold(s.firstName)) ?? 0) + 1));
    return new Map(students.map(s => [s.id, (counts.get(fold(s.firstName)) ?? 0) > 1 && s.lastName.trim() ? `${s.firstName} ${s.lastName.trim()[0].toUpperCase()}.` : s.firstName]));
}
export const initials = (s: Pick<Student, 'firstName' | 'lastName'>) =>
    `${s.firstName.trim()[0] ?? ''}${s.lastName.trim()[0] ?? ''}`.toUpperCase() || '?';

export interface PassItem {
    event: WorkshopEvent;
    student: Student | undefined;
    workshop: Workshop | undefined;
    day: string;
}

const toItem = (data: AppData) => (event: WorkshopEvent): PassItem => ({
    event,
    student: data.students.find(s => s.id === event.studentId),
    workshop: data.workshops.find(w => w.id === event.workshopId),
    day: eventDay(event),
});

/** Passages d'atelier en attente de validation, du plus récent au plus ancien. */
export const pendingPasses = (data: AppData): PassItem[] =>
    data.workshopEvents.filter(e => e.status === 'pending').map(toItem(data)).sort((a, b) => b.event.timestamp.localeCompare(a.event.timestamp));

/** Passages déjà traités (validés / refusés), les plus récents d'abord. */
export const processedPasses = (data: AppData, limit: number): PassItem[] =>
    data.workshopEvents.filter(e => e.status === 'processed').sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit).map(toItem(data));

export const isSuccessfulPass = (e: WorkshopEvent) => e.type === 'validation' || e.type === 'auto_validation';

/** Regroupe des éléments par clé en gardant l'ordre d'arrivée. */
export function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const k = key(item);
        const list = groups.get(k);
        if (list) list.push(item); else groups.set(k, [item]);
    }
    return [...groups];
}
