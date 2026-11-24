import { Proficiency, Section, SkillAcquisitionDetails, StudentSkill } from '../types';

export const isAcquired = (details: SkillAcquisitionDetails | undefined): boolean =>
    details?.proficiency === Proficiency.Acquired;

export interface GrantDetails {
    date: string;
    section: Section;
    photo?: string | null;
}

/**
 * Valide des compétences pour un élève.
 * Règle : une compétence déjà acquise est ignorée — sa date, sa photo de preuve et sa
 * section d'origine sont conservées.
 * Renvoie le nouvel objet `skills` (inchangé par référence si rien n'est accordé)
 * et la liste des compétences réellement accordées.
 */
export function grantSkills(
    skills: StudentSkill,
    skillIds: Iterable<string>,
    details: GrantDetails | ((skillId: string) => GrantDetails),
): { skills: StudentSkill; granted: string[] } {
    const granted: string[] = [];
    let next = skills;
    for (const skillId of new Set(skillIds)) {
        if (isAcquired(skills[skillId])) continue;
        if (next === skills) next = { ...skills };
        const d = typeof details === 'function' ? details(skillId) : details;
        next[skillId] = {
            proficiency: Proficiency.Acquired,
            date: d.date,
            section: d.section,
            ...(d.photo ? { photo: d.photo } : {}),
        };
        granted.push(skillId);
    }
    return { skills: next, granted };
}

/**
 * Retire des compétences qu'une action avait accordées à la date `grantDate`.
 * Une acquisition retouchée depuis (autre date, photo ajoutée) est conservée :
 * elle ne relève plus de cette action.
 */
export function revokeGrantedSkills(skills: StudentSkill, skillIds: Iterable<string>, grantDate: string): StudentSkill {
    let next = skills;
    for (const skillId of new Set(skillIds)) {
        const current = skills[skillId];
        if (!isAcquired(current) || current.date !== grantDate || current.photo) continue;
        if (next === skills) next = { ...skills };
        next[skillId] = { proficiency: Proficiency.NotAcquired };
    }
    return next;
}

/**
 * Fusionne les acquisitions d'un élève importé dans un élève existant.
 * Une acquisition locale n'est jamais écrasée (ni par « Non acquis », ni par une autre date) ;
 * les acquisitions importées complètent les compétences non acquises localement.
 */
export function mergeImportedSkills(local: StudentSkill, imported: StudentSkill): StudentSkill {
    const merged: StudentSkill = { ...local };
    for (const [skillId, details] of Object.entries(imported)) {
        if (isAcquired(local[skillId])) continue;
        if (isAcquired(details) || !(skillId in merged)) merged[skillId] = details;
    }
    return merged;
}
