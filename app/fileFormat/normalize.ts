import { AppData, Domain, Proficiency, ReferenceAge, SchoolProgram, Skill, Student, StudentSkill } from '../types';
import { createDefaultTeacherConfig, createDefaultUiSettings, DATA_VERSION } from './defaults';

/**
 * Acquisitions creuses : seules les compétences acquises sont stockées.
 * « Non acquis » = absence d'entrée.
 */
export function sparseSkills(skills: StudentSkill | undefined): StudentSkill {
    const out: StudentSkill = {};
    for (const [id, details] of Object.entries(skills ?? {})) {
        if (details?.proficiency === Proficiency.Acquired) out[id] = details;
    }
    return out;
}

// Anciennes valeurs (sans accent) des âges de référence, encore présentes dans les fichiers
// .competences existants, dont le programme 2025 fourni.
const LEGACY_REFERENCE_AGES: Record<string, ReferenceAge> = {
    'A partir de 4 ans': ReferenceAge.At4,
    'A partir de 5 ans': ReferenceAge.Over4,
};

const normalizeSkill = (s: Skill): Skill => ({
    ...s,
    name: s.name ?? '',
    referenceAges: Array.isArray(s.referenceAges) ? s.referenceAges.map(age => LEGACY_REFERENCE_AGES[age] ?? age) : [],
});

const normalizeDomain = (d: Domain): Domain => ({
    ...d,
    name: d.name ?? '',
    expectations: Array.isArray(d.expectations) ? d.expectations : [],
    skills: (Array.isArray(d.skills) ? d.skills : []).map(normalizeSkill),
    subDomains: (Array.isArray(d.subDomains) ? d.subDomains : []).map(normalizeDomain),
});

/** Valeurs par défaut d'un programme (import .competences, fichiers anciens ou incomplets). */
export const normalizePrograms = (programs: SchoolProgram[]): SchoolProgram[] =>
    (Array.isArray(programs) ? programs : []).map(p => ({
        ...p,
        name: p.name ?? '',
        domains: (Array.isArray(p.domains) ? p.domains : []).map(normalizeDomain),
    }));

const normalizeStudent = (s: Student): Student => ({
    ...s,
    photo: s.photo ?? null,
    skills: sparseSkills(s.skills),
    domainComments: s.domainComments ?? {},
});

/**
 * Point d'entrée unique de la mise à niveau des données lues (fichier, import) :
 * champs manquants complétés, anciennes options migrées, acquisitions creuses.
 * Ne modifie pas l'objet reçu.
 */
export function normalizeAppData(raw: Partial<AppData>): AppData {
    const teacherConfig = { ...createDefaultTeacherConfig(), ...(raw.teacherConfig ?? {}) };
    // Envoi de mails supprimé : on purge l'ancienne configuration SMTP (mot de passe compris).
    delete (teacherConfig as { emailConfig?: unknown }).emailConfig;

    // Ancienne configuration à 2 périodes → domainCommentPeriods
    if (!raw.teacherConfig?.domainCommentPeriods) {
        teacherConfig.domainCommentPeriods = teacherConfig.usePeriodsForDomainComments
            ? [
                { id: 'period-0', name: teacherConfig.period1Name || 'Période 1', active: true },
                { id: 'period-1', name: teacherConfig.period2Name || 'Période 2', active: !!teacherConfig.period2Name?.trim() },
            ]
            : [{ id: 'period-0', name: '', active: true }];
    }

    const uiSettings = { ...createDefaultUiSettings(), ...(raw.uiSettings ?? {}) };
    if (typeof uiSettings.autoSaveInterval !== 'number') uiSettings.autoSaveInterval = 5;

    return {
        ...raw,
        version: DATA_VERSION,
        students: (Array.isArray(raw.students) ? raw.students : []).map(normalizeStudent),
        schoolPrograms: normalizePrograms(raw.schoolPrograms ?? []),
        workshops: (Array.isArray(raw.workshops) ? raw.workshops : []).map(w => ({ ...w, skillIds: Array.isArray(w.skillIds) ? w.skillIds : [] })),
        workshopEvents: Array.isArray(raw.workshopEvents) ? raw.workshopEvents : [],
        supportGroups: Array.isArray(raw.supportGroups) ? raw.supportGroups : [],
        teacherConfig,
        uiSettings,
    };
}
