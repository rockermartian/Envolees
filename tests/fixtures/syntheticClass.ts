// Copie du générateur de l'application de bureau (tests/fixtures/syntheticClass.ts), chemins adaptés.
// Générateur de classe synthétique (performance, tests de fumée).
// Les images sont des octets aléatoires de taille réaliste (photo WebP 500 px ≈ 37 Ko) :
// incompressibles comme de vraies photos, et toutes distinctes.
import { readFileSync } from 'node:fs';
import { AppData, Domain, Proficiency, SchoolProgram, Section, Sex, WorkshopEvent } from '../../core/types';
import { createEmptyAppData } from '../../core/fileFormat/defaults';
import { computeImageRef } from '../../core/images/imageStore';

export const PROFILES = {
  moyen:      { students: 26, photosPerStudent: 20,  acquiredRatio: 0.30, workshops: 8,  eventsPerStudent: 40 },
  lourd:      { students: 30, photosPerStudent: 70,  acquiredRatio: 0.65, workshops: 15, eventsPerStudent: 150 },
  tres_lourd: { students: 32, photosPerStudent: 140, acquiredRatio: 0.85, workshops: 25, eventsPerStudent: 300 },
} as const;
export type ProfileName = keyof typeof PROFILES;

const PHOTO_BYTES = 37_000;

export const loadProgram = (projectRoot: string): SchoolProgram[] =>
  JSON.parse(readFileSync(`${projectRoot}/programmes-competences-2025-sans-illustrations.competences`, 'utf8'));

const allSkillIds = (programs: SchoolProgram[]) => {
  const ids: string[] = [];
  const walk = (d: Domain) => { d.skills.forEach(s => ids.push(s.id)); d.subDomains.forEach(walk); };
  programs.forEach(p => p.domains.forEach(walk));
  return ids;
};

export async function generateClass(profile: ProfileName, projectRoot: string): Promise<{ data: AppData; images: Map<string, Uint8Array> }> {
  const P = PROFILES[profile];
  let seed = 42;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const images = new Map<string, Uint8Array>();
  const newImage = async (size = PHOTO_BYTES) => {
    const bytes = new Uint8Array(size);
    for (let o = 0; o < size; o += 65536) crypto.getRandomValues(bytes.subarray(o, Math.min(o + 65536, size)));
    const ref = await computeImageRef(bytes, 'image/webp');
    images.set(ref, bytes);
    return ref;
  };

  const programs = loadProgram(projectRoot);
  const skillIds = allSkillIds(programs);
  const data = createEmptyAppData();
  data.schoolPrograms = programs;
  data.teacherConfig.teacherSignature = await newImage(8000);

  for (let i = 0; i < P.students; i++) {
    const skills: AppData['students'][number]['skills'] = {};
    let photos = 0;
    for (const id of skillIds) {
      if (rnd() >= P.acquiredRatio) continue;
      skills[id] = { proficiency: Proficiency.Acquired, date: `2025-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`, section: Section.MS };
      if (photos++ < P.photosPerStudent) skills[id].photo = await newImage();
    }
    data.students.push({
      id: `eleve-${i}`, firstName: `Prénom${i}`, lastName: `Nom${i}`, photo: await newImage(20_000),
      dob: '2020-05-12', section: Section.MS, sex: i % 2 ? Sex.Boy : Sex.Girl, skills,
      teacherComment: 'Élève investi(e), curieux(se) et participatif(ve). '.repeat(8),
      domainComments: Object.fromEntries(programs[0].domains.map(d => [d.id, ['Bonne progression sur ce domaine.']])),
    });
  }
  for (let w = 0; w < P.workshops; w++) {
    data.workshops.push({ id: `atelier-${w}`, name: `Atelier ${w}`, description: '', image: await newImage(), skillIds: skillIds.slice(w * 3, w * 3 + 3), isActive: true, createdAt: '2025-01-01T00:00:00.000Z' });
  }
  data.students.forEach(s => {
    for (let e = 0; e < P.eventsPerStudent; e++) {
      const ev: WorkshopEvent = { id: `${s.id}-ev-${e}`, workshopId: data.workshops[e % P.workshops].id, studentId: s.id, timestamp: new Date(Date.UTC(2025, 0, 1 + (e % 300))).toISOString(), type: 'validation', status: 'processed', grantedSkillIds: [] };
      data.workshopEvents.push(ev);
    }
  });
  return { data, images };
}
