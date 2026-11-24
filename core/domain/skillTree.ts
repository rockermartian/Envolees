// Arbre des compétences : programmes › domaines (imbriqués) › compétences.
// Opérations pures et immuables (les états sont partagés avec l'historique Annuler).
import { AppData, Domain, SchoolProgram, Skill } from '../types';

export type TreeItemKind = 'program' | 'domain' | 'skill';
export type MovePosition = 'before' | 'after' | 'inside';

interface Located {
    kind: TreeItemKind;
    /** Identifiants des ancêtres, du programme jusqu'au parent direct. */
    ancestors: string[];
}

/** Type et ancêtres de chaque élément de l'arbre. */
export function indexTree(programs: SchoolProgram[]): Map<string, Located> {
    const index = new Map<string, Located>();
    const walk = (d: Domain, ancestors: string[]) => {
        index.set(d.id, { kind: 'domain', ancestors });
        const inside = [...ancestors, d.id];
        d.skills.forEach(s => index.set(s.id, { kind: 'skill', ancestors: inside }));
        (d.subDomains ?? []).forEach(sd => walk(sd, inside));
    };
    programs.forEach(p => {
        index.set(p.id, { kind: 'program', ancestors: [] });
        p.domains.forEach(d => walk(d, [p.id]));
    });
    return index;
}

/** Identifiants de tout ce que contient un programme ou un domaine (domaines et compétences). */
export function descendantIds(programs: SchoolProgram[], id: string): string[] {
    const index = indexTree(programs);
    return [...index].filter(([, loc]) => loc.ancestors.includes(id)).map(([childId]) => childId);
}

/** Ancêtres d'un élément (programme, domaines parents). */
export const ancestorIds = (programs: SchoolProgram[], id: string): string[] => indexTree(programs).get(id)?.ancestors ?? [];

/** Identifiants visibles d'un arbre (ex. arbre filtré par la recherche). */
export function allTreeIds(programs: SchoolProgram[]): string[] {
    return [...indexTree(programs).keys()];
}

export interface TreeSelection {
    programIds: string[];
    domainIds: string[];
    skillIds: string[];
}

/**
 * Sélection effective : un programme ou un domaine n'est retenu que si lui-même ET tout son contenu
 * sont cochés. Sinon, seuls ses éléments cochés le sont (M1 : cocher un domaine puis décocher
 * quelques compétences ne doit plus supprimer tout le domaine).
 */
export function resolveSelection(programs: SchoolProgram[], selected: ReadonlySet<string>): TreeSelection {
    const out: TreeSelection = { programIds: [], domainIds: [], skillIds: [] };
    const fully = (id: string, children: string[]) => selected.has(id) && children.every(c => selected.has(c));
    const childrenOf = (d: Domain): string[] => [...d.skills.map(s => s.id), ...(d.subDomains ?? []).flatMap(sd => [sd.id, ...childrenOf(sd)])];
    const walk = (d: Domain) => {
        if (fully(d.id, childrenOf(d))) { out.domainIds.push(d.id); return; }
        d.skills.forEach(s => { if (selected.has(s.id)) out.skillIds.push(s.id); });
        (d.subDomains ?? []).forEach(walk);
    };
    programs.forEach(p => {
        if (fully(p.id, p.domains.flatMap(d => [d.id, ...childrenOf(d)]))) out.programIds.push(p.id);
        else p.domains.forEach(walk);
    });
    return out;
}

// ---------------------------------------------------------------------------------------------
// Déplacement (glisser-déposer, fenêtre « Déplacer »)
// ---------------------------------------------------------------------------------------------

export type MoveResult = { ok: true; programs: SchoolProgram[] } | { ok: false; reason: string };

const ACCEPTED: Record<TreeItemKind, Record<MovePosition, TreeItemKind[]>> = {
    program: { inside: ['domain'], before: [], after: [] },
    domain: { inside: ['domain', 'skill'], before: ['domain'], after: ['domain'] },
    skill: { inside: [], before: ['skill'], after: ['skill'] },
};

/**
 * Déplace des éléments. Tout est vérifié AVANT de modifier l'arbre (C6) : en cas de refus, l'arbre
 * est inchangé et `reason` explique pourquoi. Le type des éléments est lu dans l'arbre (jamais
 * déduit de leurs champs) ; déplacer un domaine déplace son contenu.
 */
export function moveTreeItems(programs: SchoolProgram[], itemIds: string[], targetId: string, position: MovePosition): MoveResult {
    const index = indexTree(programs);
    const target = index.get(targetId);
    if (!target) return { ok: false, reason: 'Destination introuvable.' };

    let items = [...new Set(itemIds)].map(id => ({ id, loc: index.get(id) })).filter((i): i is { id: string; loc: Located } => !!i.loc);
    if (items.length === 0) return { ok: false, reason: 'Aucun élément à déplacer.' };
    if (items.some(i => i.loc.kind === 'program')) return { ok: false, reason: 'Un programme ne peut pas être déplacé.' };

    // Un élément contenu dans un domaine déplacé suit son domaine
    const movedDomains = new Set(items.filter(i => i.loc.kind === 'domain').map(i => i.id));
    items = items.filter(i => !i.loc.ancestors.some(a => movedDomains.has(a)));

    if (movedDomains.has(targetId) || target.ancestors.some(a => movedDomains.has(a)) || items.some(i => i.id === targetId)) {
        return { ok: false, reason: 'Impossible de déplacer un domaine dans lui-même ou dans l\'un de ses sous-domaines.' };
    }
    const accepted = ACCEPTED[target.kind][position];
    if (items.some(i => !accepted.includes(i.loc.kind))) {
        return {
            ok: false,
            reason: items.some(i => i.loc.kind === 'skill')
                ? 'Une compétence se place dans un domaine ou à côté d\'une autre compétence.'
                : 'Un domaine se place dans un programme, dans un domaine ou à côté d\'un autre domaine.',
        };
    }

    // 1. Extraction (ordre de l'arbre conservé)
    const ids = new Set(items.map(i => i.id));
    const extracted: (Skill | Domain)[] = [];
    const strip = (d: Domain): Domain => ({
        ...d,
        skills: d.skills.filter(s => (ids.has(s.id) ? (extracted.push(s), false) : true)),
        subDomains: (d.subDomains ?? []).filter(sd => (ids.has(sd.id) ? (extracted.push(sd), false) : true)).map(strip),
    });
    const stripped = programs.map(p => ({
        ...p,
        domains: p.domains.filter(d => (ids.has(d.id) ? (extracted.push(d), false) : true)).map(strip),
    }));
    const skillsOut = extracted.filter(x => index.get(x.id)?.kind === 'skill') as Skill[];
    const domainsOut = extracted.filter(x => index.get(x.id)?.kind === 'domain') as Domain[];

    // 2. Insertion à la cible
    const insertNear = <T extends { id: string }>(list: T[], moved: T[]): T[] | null => {
        const at = list.findIndex(x => x.id === targetId);
        if (at < 0) return null;
        const copy = [...list];
        copy.splice(position === 'after' ? at + 1 : at, 0, ...moved);
        return copy;
    };
    let inserted = false;
    const place = (d: Domain): Domain => {
        if (inserted) return d;
        if (d.id === targetId && position === 'inside') {
            inserted = true;
            return { ...d, skills: [...d.skills, ...skillsOut], subDomains: [...(d.subDomains ?? []), ...domainsOut] };
        }
        if (target.kind === 'skill') {
            const skills = insertNear(d.skills, skillsOut);
            if (skills) { inserted = true; return { ...d, skills }; }
        }
        if (target.kind === 'domain' && position !== 'inside') {
            const subDomains = insertNear(d.subDomains ?? [], domainsOut);
            if (subDomains) { inserted = true; return { ...d, subDomains }; }
        }
        return { ...d, subDomains: (d.subDomains ?? []).map(place) };
    };
    const result = stripped.map(p => {
        if (inserted) return p;
        if (p.id === targetId) { inserted = true; return { ...p, domains: [...p.domains, ...domainsOut] }; }
        if (target.kind === 'domain' && position !== 'inside') {
            const domains = insertNear(p.domains, domainsOut);
            if (domains) { inserted = true; return { ...p, domains }; }
        }
        return { ...p, domains: p.domains.map(place) };
    });
    return inserted ? { ok: true, programs: result } : { ok: false, reason: 'Destination introuvable.' };
}

// ---------------------------------------------------------------------------------------------
// Suppression (une seule opération : arbre + acquisitions + références)
// ---------------------------------------------------------------------------------------------

/**
 * Supprime des programmes, domaines et compétences ET, dans la même opération (une seule entrée
 * d'historique), les acquisitions des élèves sur les compétences supprimées (M6), les références
 * des ateliers et les filtres des groupes de soutien.
 */
export function deleteTreeItems(data: AppData, selection: TreeSelection): AppData {
    const removedRoots = new Set([...selection.programIds, ...selection.domainIds, ...selection.skillIds]);
    if (removedRoots.size === 0) return data;
    const index = indexTree(data.schoolPrograms);
    const removed = new Set<string>(removedRoots);
    index.forEach((loc, id) => { if (loc.ancestors.some(a => removedRoots.has(a))) removed.add(id); });
    const removedSkills = new Set([...removed].filter(id => index.get(id)?.kind === 'skill'));

    const prune = (d: Domain): Domain => ({
        ...d,
        skills: d.skills.filter(s => !removed.has(s.id)),
        subDomains: (d.subDomains ?? []).filter(sd => !removed.has(sd.id)).map(prune),
    });
    const schoolPrograms = data.schoolPrograms
        .filter(p => !removed.has(p.id))
        .map(p => ({ ...p, domains: p.domains.filter(d => !removed.has(d.id)).map(prune) }));

    const students = data.students.map(s => {
        const gone = Object.keys(s.skills).filter(id => removedSkills.has(id));
        if (gone.length === 0) return s;
        const skills = { ...s.skills };
        gone.forEach(id => delete skills[id]);
        return { ...s, skills };
    });
    const workshops = data.workshops.map(w => (w.skillIds.some(id => removedSkills.has(id)) ? { ...w, skillIds: w.skillIds.filter(id => !removedSkills.has(id)) } : w));
    const filterRemoved = (fid: string) => !removed.has(fid.replace(/^(d|sk):/, ''));
    const supportGroups = (data.supportGroups ?? []).map(g => (g.filterIds.every(filterRemoved) ? g : { ...g, filterIds: g.filterIds.filter(filterRemoved) }));

    return { ...data, schoolPrograms, students, workshops, supportGroups };
}

/**
 * Voisin d'un domaine ou d'une compétence dans sa propre liste (même parent, même nature) :
 * delta -1 = précédent, +1 = suivant. Sert au réordonnancement au clavier (Monter / Descendre).
 */
export function neighborId(programs: SchoolProgram[], id: string, delta: -1 | 1): string | null {
    const lists: { id: string }[][] = [];
    const walk = (d: Domain) => { lists.push(d.skills, d.subDomains ?? []); (d.subDomains ?? []).forEach(walk); };
    programs.forEach(p => { lists.push(p.domains); p.domains.forEach(walk); });
    for (const list of lists) {
        const at = list.findIndex(x => x.id === id);
        if (at >= 0) return list[at + delta]?.id ?? null;
    }
    return null;
}
