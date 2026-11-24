import { Section, Sex, Domain, SchoolProgram, Student, SupportGroup, Proficiency } from './types';
import { ageOn } from './domain/dates';

/** Âge en années révolues (date de naissance lue en heure locale ; 0 si absente ou invalide). */
export function calculateAge(dob: string): number {
  return ageOn(dob);
}

export function getAgeColorClasses(age: number): string {
  if (age < 4) {
    return 'border-pink-500'; // Rose
  }
  if (age === 4) {
    return 'border-green-500'; // Vert
  }
  return 'border-blue-500'; // Bleu
}

export const sectionNames: { [key in Section]: string } = {
    [Section.TPS]: "Toute Petite Section",
    [Section.PS]: "Petite Section",
    [Section.MS]: "Moyenne Section",
    [Section.GS]: "Grande Section",
};

export const sexNames: { [key in Sex]: string } = {
    [Sex.Boy]: "Garçon",
    [Sex.Girl]: "Fille",
};

export const sectionOrder: Section[] = [Section.TPS, Section.PS, Section.MS, Section.GS];

export const promoteSection = (currentSection: Section): Section | null => {
  const currentIndex = sectionOrder.indexOf(currentSection);
  if (currentIndex === -1 || currentIndex === sectionOrder.length - 1) {
    return null; // Non trouvé ou déjà au plus haut niveau
  }
  return sectionOrder[currentIndex + 1];
};


export const getDescendantIds = (domain: Domain): string[] => {
    let ids: string[] = [];
    domain.skills.forEach(skill => ids.push(skill.id));
    if (domain.subDomains) {
        domain.subDomains.forEach(subDomain => {
            ids.push(subDomain.id);
            ids = ids.concat(getDescendantIds(subDomain));
        });
    }
    return ids;
};

export const getAllSkillIdsInDomain = (domain: Domain): string[] => {
    let ids: string[] = domain.skills.map(skill => skill.id);
    if (domain.subDomains) {
        domain.subDomains.forEach(subDomain => {
            ids = ids.concat(getAllSkillIdsInDomain(subDomain));
        });
    }
    return ids;
};

// Construit la table filtre → compétences, avec le même schéma d'identifiants que
// l'onglet Classe (d:<domainId> pour un domaine/sous-domaine, sk:<skillId> pour une compétence).
export const buildFilterScopeSkillIds = (schoolPrograms: SchoolProgram[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    const walk = (domain: Domain) => {
        map.set(`d:${domain.id}`, getAllSkillIdsInDomain(domain));
        domain.skills.forEach(sk => map.set(`sk:${sk.id}`, [sk.id]));
        (domain.subDomains || []).forEach(walk);
    };
    schoolPrograms.forEach(p => p.domains.forEach(walk));
    return map;
};

export interface SupportGroupMember {
    student: Student;
    acquired: number; // compétences acquises parmi celles des filtres
    total: number;    // nombre de compétences des filtres
}

/**
 * Composition d'un groupe de soutien — calcul unique, utilisé par l'onglet Classe ET la validation en masse.
 * - Groupe libre : les élèves choisis (élèves supprimés ignorés).
 * - Groupe suggéré : les N élèves les moins avancés sur les compétences des filtres (N = maxStudents,
 *   choisi par l'enseignant). Un élève **exclu est remplacé par le suivant** ; un élève **ajouté**
 *   manuellement vient en plus (il n'occupe pas une des N places). Égalités départagées par le nom.
 */
export function computeSupportGroup(group: SupportGroup, students: Student[], schoolPrograms: SchoolProgram[]): { ranked: SupportGroupMember[]; added: Student[] } {
    if (group.type === 'free') {
        const chosen = new Set(group.studentIds || []);
        return { ranked: [], added: students.filter(s => chosen.has(s.id)) };
    }
    const addedIds = new Set(group.addedStudentIds || []);
    const added = students.filter(s => addedIds.has(s.id));
    if (!group.filterIds || group.filterIds.length === 0) return { ranked: [], added };

    const scopeMap = buildFilterScopeSkillIds(schoolPrograms);
    const skillIdSet = new Set<string>();
    group.filterIds.forEach(fid => scopeMap.get(fid)?.forEach(id => skillIdSet.add(id)));
    const skillIds = [...skillIdSet];

    const excluded = new Set(group.excludedStudentIds || []);
    const byName = (a: Student, b: Student) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr');
    const ranked = students
        .filter(s => !excluded.has(s.id) && !addedIds.has(s.id))
        .map(s => ({ student: s, acquired: skillIds.filter(id => s.skills[id]?.proficiency === Proficiency.Acquired).length, total: skillIds.length }))
        .sort((a, b) => a.acquired - b.acquired || byName(a.student, b.student))
        .slice(0, Math.max(0, group.maxStudents));
    return { ranked, added };
}

/** Identifiants des élèves d'un groupe de soutien (voir computeSupportGroup). */
export const resolveSupportGroupStudentIds = (group: SupportGroup, students: Student[], schoolPrograms: SchoolProgram[]): string[] => {
    const { ranked, added } = computeSupportGroup(group, students, schoolPrograms);
    return [...new Set([...ranked.map(r => r.student.id), ...added.map(s => s.id)])];
};

// Fusion d'un import (programme .competences, compétences d'un import d'élèves).
// Immuable : les objets existants ne sont jamais modifiés (ils sont partagés avec l'historique).
// Par identifiant À TOUS LES NIVEAUX (M5) : un domaine ou une compétence déjà présent ailleurs dans
// le programme (déplacé par l'enseignant) est mis à jour là où il se trouve, jamais dupliqué.
const cloneDomain = (d: Domain): Domain => ({
    ...d,
    expectations: [...(d.expectations || [])],
    skills: [...(d.skills || [])],
    subDomains: (d.subDomains || []).map(cloneDomain),
});

const mergeProgram = (existing: SchoolProgram, imported: SchoolProgram): SchoolProgram => {
    // Copie de travail (seule celle-ci est modifiée)
    const result: SchoolProgram = { ...existing, domains: existing.domains.map(cloneDomain) };
    const domainById = new Map<string, Domain>();
    const skillOwner = new Map<string, Domain>();
    const indexDomain = (d: Domain) => {
        domainById.set(d.id, d);
        d.skills.forEach(sk => skillOwner.set(sk.id, d));
        d.subDomains.forEach(indexDomain);
    };
    result.domains.forEach(indexDomain);

    const mergeContent = (imp: Domain, into: Domain) => {
        for (const sk of imp.skills || []) {
            const owner = skillOwner.get(sk.id);
            if (owner) owner.skills = owner.skills.map(x => (x.id === sk.id ? sk : x)); // mise à jour sur place
            else { into.skills.push(sk); skillOwner.set(sk.id, into); }
        }
        for (const sub of imp.subDomains || []) placeDomain(sub, into.subDomains);
    };
    const placeDomain = (imp: Domain, siblings: Domain[]) => {
        const found = domainById.get(imp.id);
        if (found) {
            // Un import sans attendus n'efface pas les attendus existants.
            if (imp.expectations?.length) found.expectations = imp.expectations;
            mergeContent(imp, found);
            return;
        }
        const created: Domain = { ...imp, expectations: imp.expectations || [], skills: [], subDomains: [] };
        siblings.push(created);
        domainById.set(created.id, created);
        mergeContent(imp, created);
    };
    (imported.domains || []).forEach(d => placeDomain(d, result.domains));
    return result;
};

export const mergePrograms = (existing: SchoolProgram[], imported: SchoolProgram[]): SchoolProgram[] => {
    const merged = new Map(existing.map(p => [p.id, p]));
    for (const impProg of imported) {
        const exProg = merged.get(impProg.id);
        merged.set(impProg.id, exProg ? mergeProgram(exProg, impProg) : impProg);
    }
    return Array.from(merged.values());
};
