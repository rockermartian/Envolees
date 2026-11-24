// Règles du mode élève : décision à chaque lecture de QR code, code PIN enseignant.
import { Proficiency, Student, Workshop, WorkshopEvent } from '../types';
import { localDayOf, toLocalISODate } from './dates';

// ---------------------------------------------------------------------------------------------
// Lecture d'un QR code d'atelier
// ---------------------------------------------------------------------------------------------

/** Délai minimal par défaut entre le 1er scan (début de l'atelier) et le 2e (atelier terminé). */
export const DEFAULT_MIN_MINUTES_BETWEEN_SCANS = 5;

export type ScanDecision =
    | { kind: 'unknown' }                         // QR code qui n'est pas un atelier de la classe
    | { kind: 'paused' }                          // atelier en pause
    | { kind: 'already_completed' }               // toutes les compétences déjà acquises
    | { kind: 'first_scan' }                      // début de l'atelier
    | { kind: 'too_soon'; minutesLeft: number }   // 2e scan trop rapproché du 1er
    | { kind: 'second_scan' };                    // atelier terminé : validation

export function decideScan(
    qrData: string,
    student: Student,
    workshops: Workshop[],
    events: WorkshopEvent[],
    now: Date,
    minMinutesBetweenScans: number = DEFAULT_MIN_MINUTES_BETWEEN_SCANS,
): ScanDecision {
    const workshop = workshops.find(w => w.id === qrData);
    if (!workshop) return { kind: 'unknown' };
    if (!workshop.isActive) return { kind: 'paused' };
    if (workshop.skillIds.length > 0 && workshop.skillIds.every(id => student.skills[id]?.proficiency === Proficiency.Acquired)) {
        return { kind: 'already_completed' };
    }

    const today = toLocalISODate(now);
    const todays = events.filter(e => e.workshopId === workshop.id && e.studentId === student.id && localDayOf(e.timestamp) === today);
    if (!todays.some(e => e.type === 'scan' || e.type === 'validation' || e.type === 'auto_validation')) return { kind: 'first_scan' };

    // Délai compté depuis le 1er scan du jour (passage en attente)
    const firstScan = todays.filter(e => e.type === 'scan').map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b)[0];
    if (firstScan !== undefined && minMinutesBetweenScans > 0) {
        const elapsedMinutes = (now.getTime() - firstScan) / 60_000;
        if (elapsedMinutes < minMinutesBetweenScans) {
            return { kind: 'too_soon', minutesLeft: Math.max(1, Math.ceil(minMinutesBetweenScans - elapsedMinutes)) };
        }
    }
    return { kind: 'second_scan' };
}

// ---------------------------------------------------------------------------------------------
// Code PIN enseignant
// ---------------------------------------------------------------------------------------------

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

const isTrivialPin = (pin: string): boolean => {
    if (/^(\d)\1+$/.test(pin)) return true; // 0000, 1111…
    const digits = [...pin].map(Number);
    const steps = digits.slice(1).map((d, i) => d - digits[i]);
    return steps.every(s => s === 1) || steps.every(s => s === -1); // 1234, 9876…
};

/** Un code PIN est « défini » s'il est valide et n'est pas l'ancien code par défaut 0000. */
export const isPinDefined = (pin: string | undefined): pin is string =>
    !!pin && new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin) && pin !== '0000';

/** Message d'erreur pour un nouveau code PIN, ou null s'il est acceptable. */
export function validateNewPin(pin: string, confirmation: string): string | null {
    if (!/^\d*$/.test(pin)) return 'Le code ne doit contenir que des chiffres.';
    if (pin.length < PIN_MIN_LENGTH) return `Le code doit comporter au moins ${PIN_MIN_LENGTH} chiffres.`;
    if (pin.length > PIN_MAX_LENGTH) return `Le code doit comporter au plus ${PIN_MAX_LENGTH} chiffres.`;
    if (isTrivialPin(pin)) return 'Ce code est trop facile à deviner (chiffres identiques ou qui se suivent).';
    if (pin !== confirmation) return 'Les deux codes ne correspondent pas.';
    return null;
}

/** Essais de code PIN : après 5 échecs, blocage de 30 s, puis 60 s, 2 min… (10 min au plus). */
export interface PinAttempts {
    failures: number;
    lockedUntil: number; // horodatage (ms), 0 si non bloqué
}

export const NO_PIN_ATTEMPTS: PinAttempts = { failures: 0, lockedUntil: 0 };
const FAILURES_BEFORE_LOCK = 5;

export function registerPinAttempt(state: PinAttempts, success: boolean, now: number): PinAttempts {
    if (success) return NO_PIN_ATTEMPTS;
    const failures = state.failures + 1;
    if (failures % FAILURES_BEFORE_LOCK !== 0) return { failures, lockedUntil: state.lockedUntil };
    const round = failures / FAILURES_BEFORE_LOCK; // 1, 2, 3…
    const lockMs = Math.min(30_000 * 2 ** (round - 1), 10 * 60_000);
    return { failures, lockedUntil: now + lockMs };
}

/** Secondes de blocage restantes (0 si l'on peut saisir le code). */
export const pinLockSecondsLeft = (state: PinAttempts, now: number): number =>
    Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
