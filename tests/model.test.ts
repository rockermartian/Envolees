import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createEmptyAppData } from '../core/fileFormat/defaults';
import { normalizePrograms } from '../core/fileFormat/normalize';
import { loadProgram } from './fixtures/syntheticClass';
import { Proficiency, Section, Sex, type AppData, type Student } from '../core/types';
import { activePrograms, countAcquired, flattenSkills, fold, groupBy, initials, matchesQuery, pendingPasses, shortNames, sortStudents } from '../src/ui/model';
import { envoleesFileName } from '../src/platform/fileAccess';
import { imageNamesOf } from '../src/platform/library';

const ROOT = fileURLToPath(new URL('./fixtures', import.meta.url));
const student = (id: string, firstName: string, extra: Partial<Student> = {}): Student =>
    ({ id, firstName, lastName: 'Martin', photo: null, dob: '2021-01-01', section: Section.MS, sex: Sex.Girl, skills: {}, ...extra });

describe('interface mobile — lecture du programme', () => {
    it('programme 2025 fourni : 435 compétences à plat, avec le chemin des domaines', () => {
        const flat = flattenSkills(normalizePrograms(loadProgram(ROOT)));
        expect(flat).toHaveLength(435);
        expect(flat[0].path[0]).toMatch(/^D1\./);
        expect(new Set(flat.map(f => f.skill.id)).size).toBe(435);
    });

    it('programmes désactivés ignorés', () => {
        const data: AppData = { ...createEmptyAppData(), schoolPrograms: [
            { id: 'a', name: 'A', domains: [] }, { id: 'b', name: 'B', domains: [], enabled: false },
        ] };
        expect(activePrograms(data).map(p => p.id)).toEqual(['a']);
    });

    it('acquisitions comptées (seules les « Acquis »)', () => {
        const s = student('s', 'Léa', { skills: { k1: { proficiency: Proficiency.Acquired, date: '2025-01-01' }, k2: { proficiency: Proficiency.NotAcquired } } });
        expect(countAcquired(s, ['k1', 'k2', 'k3'])).toBe(1);
    });
});

describe('interface mobile — recherche et tri', () => {
    it('recherche sans accents ni casse, mots dans le désordre', () => {
        expect(fold('  Élodie  ÉCRIT ')).toBe('elodie ecrit');
        expect(matchesQuery('ecrire prenom', 'Écrire son prénom en capitales')).toBe(true);
        expect(matchesQuery('dessin', 'Écrire son prénom')).toBe(false);
        expect(matchesQuery('', 'n\'importe quoi')).toBe(true);
    });

    it('élèves triés par prénom (ordre français), initiales', () => {
        expect(sortStudents([student('1', 'Zoé'), student('2', 'Élise'), student('3', 'Adam')]).map(s => s.firstName)).toEqual(['Adam', 'Élise', 'Zoé']);
        expect(initials(student('1', 'léa'))).toBe('LM');
    });

    it('regroupement en gardant l\'ordre', () => {
        expect(groupBy([1, 2, 3, 4], n => (n % 2 ? 'impair' : 'pair'))).toEqual([['impair', [1, 3]], ['pair', [2, 4]]]);
    });
});

describe('interface mobile — passages d\'atelier', () => {
    it('passages en attente, du plus récent au plus ancien, avec élève et atelier', () => {
        const data: AppData = {
            ...createEmptyAppData(),
            students: [student('s', 'Léa')],
            workshops: [{ id: 'w', name: 'Puzzle', description: '', image: null, skillIds: [], isActive: true, createdAt: '' }],
            workshopEvents: [
                { id: 'e1', workshopId: 'w', studentId: 's', timestamp: '2026-03-01T09:00:00', type: 'scan', status: 'pending' },
                { id: 'e2', workshopId: 'w', studentId: 's', timestamp: '2026-03-02T09:00:00', type: 'scan', status: 'pending' },
                { id: 'e3', workshopId: 'w', studentId: 's', timestamp: '2026-03-03T09:00:00', type: 'validation', status: 'processed' },
            ],
        };
        const pending = pendingPasses(data);
        expect(pending.map(p => p.event.id)).toEqual(['e2', 'e1']);
        expect(pending[0]).toMatchObject({ day: '2026-03-02', student: { firstName: 'Léa' }, workshop: { name: 'Puzzle' } });
    });
});

describe('plateforme web', () => {
    it('noms des images d\'une classe : dédupliqués, références seulement', () => {
        expect(imageNamesOf(['img:aa.webp', 'img:aa.webp', 'data:image/png;base64,xx', 'img:bb.png'])).toEqual(['aa.webp', 'bb.png']);
    });

    it('nom de fichier .envolees sûr', () => {
        expect(envoleesFileName('Classe MS/GS : 2026')).toBe('Classe MS_GS _ 2026.envolees');
        expect(envoleesFileName('   ')).toBe('classe.envolees');
    });
});
