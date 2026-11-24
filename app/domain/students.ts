// Opérations sur les élèves de la classe : fonctions pures (AppData → AppData), sans état d'interface.
// Toutes renvoient de nouveaux objets (les états sont partagés avec l'historique Annuler).
import { AppData, Domain, SchoolProgram, Section, Sex, SkillAcquisitionDetails, Student } from '../types';
import { promoteSection } from '../utils';
import { grantSkills, isAcquired, mergeImportedSkills } from './acquisitions';

const updateStudent = (data: AppData, id: string, update: (s: Student) => Student): AppData => ({
    ...data,
    students: data.students.map(s => (s.id === id ? update(s) : s)),
});

// ---------------------------------------------------------------------------------------------
// Fiche élève
// ---------------------------------------------------------------------------------------------

export interface StudentFields {
    firstName: string;
    lastName: string;
    photo: string | null;
    dob: string;
    section: Section;
    sex: Sex;
    contactEmail?: string;
    ine?: string;
    miscInfo?: string;
}

export const addStudent = (data: AppData, fields: StudentFields, id: string): AppData => ({
    ...data,
    students: [...data.students, { id, ...fields, skills: {}, teacherComment: '', domainComments: {}, livretProcessed: false }],
});

export const updateStudentFields = (data: AppData, id: string, fields: StudentFields): AppData =>
    updateStudent(data, id, s => ({ ...s, ...fields }));

/** Supprime l'élève ET ses traces : passages d'atelier, mentions dans les groupes de soutien. */
export function deleteStudent(data: AppData, id: string): AppData {
    const without = (ids?: string[]) => ids?.filter(x => x !== id);
    return {
        ...data,
        students: data.students.filter(s => s.id !== id),
        workshopEvents: data.workshopEvents.filter(e => e.studentId !== id),
        supportGroups: (data.supportGroups ?? []).map(g => ({
            ...g,
            studentIds: without(g.studentIds) ?? [],
            addedStudentIds: without(g.addedStudentIds),
            excludedStudentIds: without(g.excludedStudentIds),
        })),
    };
}

// ---------------------------------------------------------------------------------------------
// Acquisitions
// ---------------------------------------------------------------------------------------------

export const setSkillDetails = (data: AppData, studentId: string, updates: Record<string, SkillAcquisitionDetails>): AppData =>
    updateStudent(data, studentId, s => ({ ...s, skills: { ...s.skills, ...updates } }));

/**
 * Validation en masse : les compétences déjà acquises sont ignorées (date, photo et section conservées).
 * Renvoie aussi le nombre de validations faites et de compétences conservées.
 */
export function applyMassValidation(
    data: AppData,
    { studentIds, skillIds, date, getPhoto }: { studentIds: string[]; skillIds: string[]; date: string; getPhoto: (studentId: string, skillId: string) => string | null },
): { data: AppData; granted: number; kept: number } {
    const targets = new Set(studentIds);
    let granted = 0;
    let kept = 0;
    const students = data.students.map(s => {
        if (!targets.has(s.id)) return s;
        kept += skillIds.filter(id => isAcquired(s.skills[id])).length;
        const result = grantSkills(s.skills, skillIds, skillId => ({ date, section: s.section, photo: getPhoto(s.id, skillId) }));
        granted += result.granted.length;
        return result.granted.length ? { ...s, skills: result.skills } : s;
    });
    return { data: { ...data, students }, granted, kept };
}

// ---------------------------------------------------------------------------------------------
// Livret : appréciations, bilans par domaine, élèves « traités »
// ---------------------------------------------------------------------------------------------

export type CommentField = 'teacherComment' | 'teacher2Comment' | 'directorComment';

export const setStudentComment = (data: AppData, id: string, field: CommentField, text: string): AppData =>
    updateStudent(data, id, s => ({ ...s, [field]: text }));

/** Bilan d'un domaine pour une période (les bilans sont rangés par indice de période). */
export const setDomainComment = (data: AppData, studentId: string, domainId: string, periodIndex: number, text: string): AppData =>
    updateStudent(data, studentId, s => {
        const comments = [...(s.domainComments?.[domainId] ?? [])];
        while (comments.length <= periodIndex) comments.push('');
        comments[periodIndex] = text;
        return { ...s, domainComments: { ...(s.domainComments ?? {}), [domainId]: comments } };
    });

/** Supprime une période de bilan ET réaligne les bilans de chaque élève (rangés par indice). */
export function deleteDomainPeriod(data: AppData, periodIndex: number): AppData {
    const periods = data.teacherConfig.domainCommentPeriods ?? [];
    if (periodIndex < 0 || periodIndex >= periods.length) return data;
    return {
        ...data,
        teacherConfig: { ...data.teacherConfig, domainCommentPeriods: periods.filter((_, i) => i !== periodIndex) },
        students: data.students.map(s => (!s.domainComments ? s : {
            ...s,
            domainComments: Object.fromEntries(Object.entries(s.domainComments).map(([d, list]) => [d, list.filter((_, i) => i !== periodIndex)])),
        })),
    };
}

export const toggleLivretProcessed = (data: AppData, id: string): AppData =>
    updateStudent(data, id, s => ({ ...s, livretProcessed: !s.livretProcessed }));

/** Tous « traités » si au moins un ne l'est pas ; sinon, plus aucun. */
export function toggleAllLivretProcessed(data: AppData): AppData {
    const allProcessed = data.students.length > 0 && data.students.every(s => s.livretProcessed);
    return { ...data, students: data.students.map(s => ({ ...s, livretProcessed: !allProcessed })) };
}

/** Passage à la section suivante (les GS restent en GS). */
export function promoteStudents(data: AppData, ids: string[]): AppData {
    const targets = new Set(ids);
    return {
        ...data,
        students: data.students.map(s => {
            if (!targets.has(s.id)) return s;
            const next = promoteSection(s.section);
            return next ? { ...s, section: next } : s;
        }),
    };
}

// ---------------------------------------------------------------------------------------------
// Import d'élèves (.eleves)
// ---------------------------------------------------------------------------------------------

export type ImportClassification =
    | { student: Student; action: 'merge_by_id' }
    | { student: Student; action: 'potential_duplicate'; existingId: string }
    | { student: Student; action: 'new' };

/** Élève déjà présent (même identifiant), homonyme probable (nom, prénom, date de naissance) ou nouveau. */
export function classifyImportedStudents(existing: Student[], incoming: Student[]): ImportClassification[] {
    const norm = (v: string) => v.trim().toLowerCase();
    return incoming.map(student => {
        if (existing.some(s => s.id === student.id)) return { student, action: 'merge_by_id' };
        const same = existing.find(s => norm(s.firstName) === norm(student.firstName) && norm(s.lastName) === norm(student.lastName) && s.dob === student.dob);
        if (same) return { student, action: 'potential_duplicate', existingId: same.id };
        return { student, action: 'new' };
    });
}

/**
 * Compétences acquises par les élèves importés mais absentes de la classe : extraites des
 * programmes du fichier importé (pour les ajouter comme « Compétences importées »).
 */
export function unmatchedSkillPrograms(currentPrograms: SchoolProgram[], importedStudents: Student[], importedPrograms: SchoolProgram[]): SchoolProgram[] {
    const known = new Set<string>();
    const collect = (ds: Domain[]) => ds.forEach(d => { d.skills.forEach(s => known.add(s.id)); collect(d.subDomains ?? []); });
    currentPrograms.forEach(p => collect(p.domains));
    const missing = new Set(importedStudents.flatMap(s => Object.keys(s.skills)).filter(id => !known.has(id)));
    if (missing.size === 0) return [];
    const keep = (ds: Domain[]): Domain[] => ds.reduce((acc, d) => {
        const skills = d.skills.filter(s => missing.has(s.id));
        const subDomains = keep(d.subDomains ?? []);
        if (skills.length || subDomains.length) acc.push({ ...d, skills, subDomains });
        return acc;
    }, [] as Domain[]);
    return importedPrograms.reduce((acc, p) => {
        const domains = keep(p.domains);
        if (domains.length) acc.push({ ...p, domains });
        return acc;
    }, [] as SchoolProgram[]);
}

export interface StudentImportDecision {
    student: Student;
    action: 'add' | 'merge' | 'skip';
    targetId?: string;
}

/**
 * Applique les choix de l'enseignant. Fusion : les informations importées complètent la fiche,
 * une acquisition locale n'est jamais écrasée. Ajout : nouvel identifiant si celui du fichier
 * existe déjà (jamais deux élèves avec le même identifiant).
 */
export function applyStudentImport(data: AppData, decisions: StudentImportDecision[], newId: () => string): { data: AppData; added: number; merged: number } {
    let students = data.students;
    let added = 0;
    let merged = 0;
    for (const { student, action, targetId } of decisions) {
        if (action === 'add') {
            const id = students.some(s => s.id === student.id) ? newId() : student.id;
            students = [...students, { ...student, id }];
            added++;
        } else if (action === 'merge') {
            const id = targetId ?? student.id;
            students = students.map(s => (s.id !== id ? s : {
                ...s,
                firstName: student.firstName,
                lastName: student.lastName,
                photo: student.photo ?? s.photo,
                dob: student.dob,
                section: student.section,
                sex: student.sex,
                contactEmail: student.contactEmail ?? s.contactEmail,
                ine: student.ine ?? s.ine,
                miscInfo: student.miscInfo ?? s.miscInfo,
                skills: mergeImportedSkills(s.skills, student.skills),
                teacherComment: student.teacherComment || s.teacherComment,
                domainComments: { ...(s.domainComments ?? {}), ...(student.domainComments ?? {}) },
            }));
            merged++;
        }
    }
    return { data: { ...data, students }, added, merged };
}
