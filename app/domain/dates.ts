// Dates « calendrier » (AAAA-MM-JJ) toujours lues et produites en heure LOCALE.
//
// Pourquoi : `new Date().toISOString().split('T')[0]` donne la date en UTC (la veille en métropole
// entre 0 h et 2 h, le lendemain aux Antilles le soir…) et `new Date('2025-03-14')` est lu comme
// minuit UTC (affiché le 13 mars à l'ouest de Greenwich). Toutes les dates de l'application
// passent donc par ces fonctions.

const pad = (n: number) => String(n).padStart(2, '0');

/** Date locale AAAA-MM-JJ d'un instant. */
export const toLocalISODate = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Date du jour (heure locale), AAAA-MM-JJ. */
export const todayLocalISO = (): string => toLocalISODate(new Date());

/** Lit une date AAAA-MM-JJ comme une date locale (à midi) ; null si absente ou invalide (ex. 2020-13-45). */
export function parseISODateLocal(value: string | null | undefined): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** Date AAAA-MM-JJ en français (par défaut 14/03/2025) ; chaîne vide si invalide (jamais « Invalid Date »). */
export function formatDateFR(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
    const date = parseISODateLocal(value);
    return date ? date.toLocaleDateString('fr-FR', options) : '';
}

/** Jour local (AAAA-MM-JJ) d'un horodatage ISO complet (ex. passage à un atelier). */
export function localDayOf(timestamp: string): string {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? timestamp.slice(0, 10) : toLocalISODate(date);
}

/** Âge en années révolues à la date `on` (0 si date de naissance absente ou invalide). */
export function ageOn(dob: string | null | undefined, on: Date = new Date()): number {
    const birth = parseISODateLocal(dob);
    if (!birth) return 0;
    let age = on.getFullYear() - birth.getFullYear();
    const m = on.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && on.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
}
