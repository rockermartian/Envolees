// Noms de fichiers sûrs pour Windows, macOS et Linux (exports PDF, QR codes, .atelier…).

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * Nom de fichier sûr : accents retirés (Léa → Lea), lettres de tout alphabet conservées, caractères
 * interdits (< > : " / \ | ? * …) remplacés par « - », longueur bornée, noms réservés Windows évités.
 * Jamais vide (repli `fallback`).
 */
export function safeFileName(base: string, extension: string, fallback = 'fichier'): string {
    let name = base
        .normalize('NFD').replace(/\p{M}/gu, '')   // accents et autres signes diacritiques
        .replace(/[^\p{L}\p{N}._ -]+/gu, '-')     // tout sauf lettres et chiffres (tout alphabet)
        .replace(/[\s-]+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '')
        .slice(0, 120);
    if (!name.replace(/[-_.]/g, '')) name = fallback;
    if (WINDOWS_RESERVED.test(name)) name = `_${name}`;
    return `${name}.${extension}`;
}

/** Nom du PDF d'un livret : livret-nom-prenom.pdf (les homonymes sont départagés à l'écriture). */
export const livretFileName = (student: { firstName: string; lastName: string }): string =>
    safeFileName(`livret-${student.lastName}-${student.firstName}`.toLowerCase(), 'pdf', 'livret-eleve');
