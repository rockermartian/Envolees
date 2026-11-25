// Suivi individuel d'un élève : notes datées et typées, besoins particuliers.
// Fonctions pures (AppData → AppData) : de nouveaux objets à chaque fois (états partagés avec l'historique).
import { AppData, Student, StudentNeed, StudentNote, StudentNoteKind } from '../types';

/** Types de notes, dans l'ordre d'affichage. */
export const NOTE_KINDS: { id: StudentNoteKind; label: string; short: string }[] = [
    { id: 'observation', label: 'Observation en classe', short: 'Observation' },
    { id: 'parents', label: 'Rendez-vous avec les parents', short: 'Parents' },
    { id: 'equipe', label: 'Équipe éducative, ESS', short: 'Équipe éducative' },
    { id: 'aide', label: 'Aides : RASED, AESH…', short: 'Aides' },
    { id: 'exterieur', label: 'Suivi extérieur : PMI, orthophonie, CMP…', short: 'Suivi extérieur' },
    { id: 'todo', label: 'À faire', short: 'À faire' },
];
export const noteKindLabel = (kind: StudentNoteKind): string => NOTE_KINDS.find(k => k.id === kind)?.short ?? 'Note';

/** Besoins particuliers (cases à cocher), dans l'ordre d'affichage. */
export const NEEDS: { id: StudentNeed; label: string; title: string }[] = [
    { id: 'pai', label: 'PAI', title: "Projet d'accueil individualisé (santé)" },
    { id: 'allergie', label: 'Allergie alimentaire', title: 'Allergie alimentaire' },
    { id: 'pps', label: 'PPS', title: 'Projet personnalisé de scolarisation' },
    { id: 'aesh', label: 'AESH', title: "Accompagnant(e) d'élève en situation de handicap" },
    { id: 'pap', label: 'PAP', title: "Plan d'accompagnement personnalisé" },
    { id: 'rased', label: 'RASED', title: "Suivi par le réseau d'aides spécialisées" },
    { id: 'allophone', label: 'Allophone', title: 'Élève allophone (UPE2A)' },
    { id: 'sieste', label: 'Sieste', title: "Fait la sieste à l'école" },
];
const NEED_IDS = new Set<string>(NEEDS.map(n => n.id));
const KIND_IDS = new Set<string>(NOTE_KINDS.map(k => k.id));
export const needLabel = (need: StudentNeed): string => NEEDS.find(n => n.id === need)?.label ?? need;

const updateStudent = (data: AppData, id: string, update: (s: Student) => Student): AppData => ({
    ...data,
    students: data.students.map(s => (s.id === id ? update(s) : s)),
});

/** Ajoute une note (texte non vide). */
export function addNote(data: AppData, studentId: string, note: StudentNote): AppData {
    if (!note.text.trim()) return data;
    return updateStudent(data, studentId, s => ({ ...s, notes: [...(s.notes ?? []), { ...note, text: note.text.trim() }] }));
}

/** Modifie une note (date, type, texte, épinglée, faite). */
export function updateNote(data: AppData, studentId: string, noteId: string, changes: Partial<Omit<StudentNote, 'id'>>): AppData {
    if (changes.text !== undefined && !changes.text.trim()) return data;
    return updateStudent(data, studentId, s => ({
        ...s,
        notes: (s.notes ?? []).map(n => (n.id !== noteId ? n : { ...n, ...changes, ...(changes.text !== undefined ? { text: changes.text.trim() } : {}) })),
    }));
}

export const deleteNote = (data: AppData, studentId: string, noteId: string): AppData =>
    updateStudent(data, studentId, s => ({ ...s, notes: (s.notes ?? []).filter(n => n.id !== noteId) }));

/** Coche ou décoche un besoin particulier (l'ordre de la liste NEEDS est conservé). */
export const toggleNeed = (data: AppData, studentId: string, need: StudentNeed): AppData =>
    updateStudent(data, studentId, s => {
        const current = new Set(s.needs ?? []);
        if (current.has(need)) current.delete(need); else current.add(need);
        return { ...s, needs: NEEDS.map(n => n.id).filter(id => current.has(id)) };
    });

/** Notes à afficher : épinglées d'abord, puis de la plus récente à la plus ancienne. */
export function sortNotes(notes: StudentNote[]): StudentNote[] {
    return [...notes].sort((a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned)
        || b.date.localeCompare(a.date)
        || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** Nombre de notes « À faire » non faites. */
export const openTodoCount = (student: Student): number =>
    (student.notes ?? []).filter(n => n.kind === 'todo' && !n.done).length;

/** Valeurs lues d'un fichier : notes valides seulement, besoins connus seulement. */
export function normalizeNotes(raw: unknown): StudentNote[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((n): n is StudentNote => !!n && typeof n === 'object' && typeof n.id === 'string' && typeof n.text === 'string' && typeof n.date === 'string')
        .map(n => ({ ...n, kind: KIND_IDS.has(n.kind) ? n.kind : 'observation' }));
}
export const normalizeNeeds = (raw: unknown): StudentNeed[] =>
    Array.isArray(raw) ? NEEDS.map(n => n.id).filter(id => raw.includes(id) && NEED_IDS.has(id)) : [];
