// Photos de preuve d'un élève (impression pour un cahier de suivi tenu à la main).
import { Domain, SchoolProgram, Student } from '../types';
import { isAcquired } from './acquisitions';

export interface ProofPhoto {
    skillId: string;
    skillName: string;
    date?: string;   // YYYY-MM-DD
    photo: string;   // référence img:… (ou data URL)
}

/** Nom et rang (ordre du programme) de chaque compétence. */
export function skillIndex(programs: SchoolProgram[]): Map<string, { name: string; rank: number }> {
    const index = new Map<string, { name: string; rank: number }>();
    const walk = (d: Domain) => { d.skills.forEach(s => index.set(s.id, { name: s.name, rank: index.size })); d.subDomains.forEach(walk); };
    programs.forEach(p => p.domains.forEach(walk));
    return index;
}

/**
 * Photos de preuve des compétences acquises par l'élève, de la plus ancienne à la plus récente
 * (même jour : ordre du programme ; sans date : à la fin). `from` / `to` (inclus) bornent la date
 * de validation ; une acquisition sans date est écartée dès qu'une borne est donnée.
 */
export function proofPhotosOf(
    student: Student,
    index: Map<string, { name: string; rank: number }>,
    range: { from?: string; to?: string } = {},
): ProofPhoto[] {
    const { from, to } = range;
    const out: (ProofPhoto & { rank: number })[] = [];
    for (const [skillId, details] of Object.entries(student.skills)) {
        if (!isAcquired(details) || !details.photo) continue;
        if ((from || to) && !details.date) continue;
        if (from && details.date! < from) continue;
        if (to && details.date! > to) continue;
        const skill = index.get(skillId);
        out.push({ skillId, skillName: skill?.name ?? 'Compétence supprimée', date: details.date, photo: details.photo, rank: skill?.rank ?? Number.MAX_SAFE_INTEGER });
    }
    out.sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) : a.date ? -1 : b.date ? 1 : 0) || a.rank - b.rank);
    return out.map(({ rank: _rank, ...photo }) => photo);
}
