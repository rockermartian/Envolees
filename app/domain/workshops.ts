import { AppData, Student, WorkshopEvent } from '../types';
import { grantSkills, revokeGrantedSkills } from './acquisitions';
import { localDayOf } from './dates';

/** Jour local (AAAA-MM-JJ) d'un événement d'atelier. */
export const eventDay = (event: WorkshopEvent): string => localDayOf(event.timestamp);

const isSuccess = (e: WorkshopEvent) =>
    e.status === 'processed' && (e.type === 'validation' || e.type === 'auto_validation');

const sameDayPass = (a: WorkshopEvent, b: WorkshopEvent) =>
    a.studentId === b.studentId && a.workshopId === b.workshopId && eventDay(a) === eventDay(b);

/** Remplace un élève dans la liste (nouvelle liste, sans modifier l'ancienne). */
const withStudent = (students: Student[], updated: Student): Student[] =>
    students.map(s => (s.id === updated.id ? updated : s));

/**
 * Valide ou refuse des passages d'atelier (en attente ou déjà au journal).
 * - Validation : accorde les compétences de l'atelier non encore acquises et
 *   mémorise celles réellement accordées dans `grantedSkillIds`.
 * - Refus : retire uniquement `grantedSkillIds` (ce que ce passage avait validé).
 * Valider un passage déjà validé, ou refuser un passage déjà refusé, ne change rien.
 */
export function setEventsOutcome(data: AppData, eventIds: Iterable<string>, success: boolean): AppData {
    const ids = new Set(eventIds);
    if (ids.size === 0) return data;
    let students = data.students;

    const workshopEvents = data.workshopEvents.map((event): WorkshopEvent => {
        if (!ids.has(event.id)) return event;
        const student = students.find(s => s.id === event.studentId);

        if (success) {
            if (isSuccess(event)) return event;
            const workshop = data.workshops.find(w => w.id === event.workshopId);
            let grantedSkillIds: string[] = [];
            if (workshop && student) {
                const { skills, granted } = grantSkills(student.skills, workshop.skillIds, {
                    date: eventDay(event),
                    section: student.section,
                });
                if (granted.length) students = withStudent(students, { ...student, skills });
                grantedSkillIds = granted;
            }
            return { ...event, status: 'processed', type: 'validation', grantedSkillIds };
        }

        if (event.status === 'processed' && event.type === 'rejection') return event;
        const toRevoke = event.grantedSkillIds ?? [];
        if (student && toRevoke.length) {
            const skills = revokeGrantedSkills(student.skills, toRevoke, eventDay(event));
            if (skills !== student.skills) students = withStudent(students, { ...student, skills });
        }
        return { ...event, status: 'processed', type: 'rejection', grantedSkillIds: [] };
    });

    return { ...data, workshopEvents, students };
}

/**
 * Enregistre un 1er scan (passage en attente). Ignoré si un passage est déjà en attente
 * le même jour pour cet élève et cet atelier (double lecture rapide du QR code).
 */
export function recordScan(data: AppData, event: WorkshopEvent): AppData {
    const alreadyPending = data.workshopEvents.some(e => e.status === 'pending' && sameDayPass(e, event));
    if (alreadyPending) return data;
    return { ...data, workshopEvents: [...data.workshopEvents, event] };
}

/**
 * Validation automatique (2e scan du même atelier le même jour) en une seule opération :
 * remplace les passages du jour par un unique événement `auto_validation`, accorde les
 * compétences non encore acquises, et conserve dans `grantedSkillIds` ce qu'avaient déjà
 * accordé les passages remplacés (pour qu'un refus ultérieur puisse le retirer).
 */
export function recordAutoValidation(data: AppData, event: WorkshopEvent): AppData {
    const replaced = data.workshopEvents.filter(e => sameDayPass(e, event));
    const carried = replaced.flatMap(e => e.grantedSkillIds ?? []);
    let students = data.students;
    let granted: string[] = [];

    const workshop = data.workshops.find(w => w.id === event.workshopId);
    const student = students.find(s => s.id === event.studentId);
    if (workshop && student) {
        const result = grantSkills(student.skills, workshop.skillIds, { date: eventDay(event), section: student.section });
        if (result.granted.length) students = withStudent(students, { ...student, skills: result.skills });
        granted = result.granted;
    }

    const autoEvent: WorkshopEvent = {
        ...event,
        type: 'auto_validation',
        status: 'processed',
        grantedSkillIds: [...new Set([...carried, ...granted])],
    };
    return {
        ...data,
        students,
        workshopEvents: [...data.workshopEvents.filter(e => !sameDayPass(e, event)), autoEvent],
    };
}

/**
 * Allège le journal : supprime les passages TRAITÉS antérieurs au jour `beforeDay` (AAAA-MM-JJ, exclu)
 * ainsi que les passages orphelins. Les acquisitions des élèves ne sont pas modifiées ; les passages
 * supprimés ne pourront simplement plus être refusés.
 */
export function purgeWorkshopEvents(data: AppData, beforeDay: string): { data: AppData; removed: number } {
    const studentIds = new Set(data.students.map(s => s.id));
    const workshopIds = new Set(data.workshops.map(w => w.id));
    const kept = data.workshopEvents.filter(e => {
        const orphan = !studentIds.has(e.studentId) || !workshopIds.has(e.workshopId);
        const oldProcessed = e.status === 'processed' && eventDay(e) < beforeDay;
        return !orphan && !oldProcessed;
    });
    const removed = data.workshopEvents.length - kept.length;
    return { data: removed ? { ...data, workshopEvents: kept } : data, removed };
}
