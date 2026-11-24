import JSZip from 'jszip';
import { addImageToZip, importImageFromZip } from '../images/imageArchive';
import { Workshop, SchoolProgram, Domain } from '../types';

// ─── Format .atelier ──────────────────────────────────────────────────────────
// Un fichier .atelier est une archive ZIP contenant :
//   manifest.json   → métadonnées du format (version, date, nombre d'ateliers)
//   workshops.json  → les ateliers sélectionnés (image = chemin vers images/)
//   skills.json     → définitions complètes des compétences liées (pour le
//                     remappage à l'import : match par ID puis par nom)
//   images/         → photos des ateliers (workshop_<id>.<ext>)

export const ATELIER_FORMAT_VERSION = '1.0';

export interface BundledSkill {
  id: string;
  name: string;
  domainPath: string; // "Programme › Domaine › Sous-domaine" — contexte / lisibilité
  description?: string;
}

export interface AtelierManifest {
  format: 'atelier';
  version: string;
  app: 'envolees';
  exportedAt: string;
  workshopCount: number;
}

export interface ParsedAtelierBundle {
  version: string;
  exportedAt?: string;
  workshops: Workshop[]; // image rangée dans le magasin d'images (référence img:…)
  skills: BundledSkill[];
}

// ─── Helpers internes ───────────────────────────────────────────────────────

interface SkillIndexEntry {
  id: string;
  name: string;
  domainPath: string;
  description?: string;
}

/** Aplatit tous les programmes en une liste de compétences avec leur chemin. */
const buildSkillIndex = (schoolPrograms: SchoolProgram[]): SkillIndexEntry[] => {
  const out: SkillIndexEntry[] = [];
  const recurse = (domains: Domain[], path: string) => {
    domains.forEach(d => {
      const currentPath = path ? `${path} › ${d.name}` : d.name;
      d.skills.forEach(s =>
        out.push({ id: s.id, name: s.name, domainPath: currentPath, description: s.description })
      );
      if (d.subDomains) recurse(d.subDomains, currentPath);
    });
  };
  schoolPrograms.forEach(p => recurse(p.domains, p.name));
  return out;
};

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

// ─── Export ───────────────────────────────────────────────────────────────────

/** Construit un blob .atelier à partir des ateliers sélectionnés. */
export const createAtelierBundle = async (
  workshops: Workshop[],
  schoolPrograms: SchoolProgram[]
): Promise<Blob> => {
  const zip = new JSZip();

  const skillIndex = buildSkillIndex(schoolPrograms);
  const skillById = new Map(skillIndex.map(s => [s.id, s]));

  // Compétences réellement liées aux ateliers sélectionnés
  const neededSkillIds = new Set<string>();
  workshops.forEach(w => w.skillIds.forEach(id => neededSkillIds.add(id)));

  const bundledSkills: BundledSkill[] = [];
  neededSkillIds.forEach(id => {
    const entry = skillById.get(id);
    if (entry) {
      bundledSkills.push({
        id: entry.id,
        name: entry.name,
        domainPath: entry.domainPath,
        description: entry.description,
      });
    }
  });

  // Ateliers avec image externalisée dans images/ (octets copiés tels quels)
  const bundledWorkshops: Workshop[] = [];
  for (const w of workshops) {
    bundledWorkshops.push({ ...w, image: await addImageToZip(zip, w.image) });
  }

  const manifest: AtelierManifest = {
    format: 'atelier',
    version: ATELIER_FORMAT_VERSION,
    app: 'envolees',
    exportedAt: new Date().toISOString(),
    workshopCount: bundledWorkshops.length,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('workshops.json', JSON.stringify(bundledWorkshops));
  zip.file('skills.json', JSON.stringify(bundledSkills));

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

// ─── Import ─────────────────────────────────────────────────────────────────

/** Lit un fichier .atelier et restaure les images des ateliers. */
export const parseAtelierBundle = async (file: File | Blob): Promise<ParsedAtelierBundle> => {
  const zip = await JSZip.loadAsync(file);

  const workshopsFile = zip.file('workshops.json');
  if (!workshopsFile) {
    throw new Error('Fichier .atelier invalide : workshops.json est manquant.');
  }

  const manifestFile = zip.file('manifest.json');
  const skillsFile = zip.file('skills.json');

  const parseJson = async (file: JSZip.JSZipObject): Promise<unknown> => {
    try { return JSON.parse(await file.async('string')); }
    catch { throw new Error(`Fichier .atelier invalide : ${file.name} est illisible.`); }
  };
  const manifest = (manifestFile ? await parseJson(manifestFile) : {}) as Partial<AtelierManifest>;
  if (manifestFile && manifest.format !== 'atelier') {
    throw new Error("Ce fichier n'est pas un fichier d'atelier Envolées.");
  }

  // Contenu validé : seuls les ateliers bien formés sont gardés (un fichier abîmé ne doit pas
  // faire planter l'affichage).
  const rawWorkshops = await parseJson(workshopsFile);
  if (!Array.isArray(rawWorkshops)) throw new Error('Fichier .atelier invalide : liste d\'ateliers attendue.');
  const isString = (v: unknown): v is string => typeof v === 'string';
  const workshops: Workshop[] = rawWorkshops
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object' && isString((w as Workshop).id) && isString((w as Workshop).name))
    .map(w => ({
      id: w.id as string,
      name: (w.name as string).slice(0, 200),
      description: isString(w.description) ? w.description : '',
      image: isString(w.image) ? w.image : null,
      skillIds: Array.isArray(w.skillIds) ? w.skillIds.filter(isString) : [],
      isActive: w.isActive !== false,
      createdAt: isString(w.createdAt) ? w.createdAt : new Date().toISOString(),
    }));
  if (workshops.length === 0) throw new Error('Ce fichier .atelier ne contient aucun atelier valide.');

  const rawSkills = skillsFile ? await parseJson(skillsFile) : [];
  const skills: BundledSkill[] = (Array.isArray(rawSkills) ? rawSkills : [])
    .filter((s): s is BundledSkill => !!s && typeof s === 'object' && isString(s.id) && isString(s.name))
    .map(s => ({ id: s.id, name: s.name, domainPath: isString(s.domainPath) ? s.domainPath : '', description: isString(s.description) ? s.description : undefined }));

  // Restaure les images des ateliers (chemin images/… → magasin d'images).
  // Seuls les chemins internes à l'archive sont acceptés (jamais d'URL externe).
  for (const w of workshops) {
    const image = (w as { image?: unknown }).image;
    w.image = typeof image === 'string' && (image.startsWith('images/') || image.startsWith('data:image/'))
      ? await importImageFromZip(zip, image)
      : null;
  }

  return {
    version: manifest.version ?? '1.0',
    exportedAt: manifest.exportedAt,
    workshops,
    skills,
  };
};

// ─── Remappage des compétences ────────────────────────────────────────────────

export interface SkillRemapResult {
  /** Les skillIds finaux, reliés à des compétences existant dans l'installation. */
  skillIds: string[];
  matchedById: number;
  matchedByName: number;
  /** Compétences du bundle qui n'ont pas pu être retrouvées localement. */
  unmatched: BundledSkill[];
}

/**
 * Relie les compétences d'un atelier importé aux compétences locales :
 *  1. par ID (même programme installé) ;
 *  2. sinon par nom (insensible à la casse/espaces) ;
 *  3. sinon : non reconnue (le lien est abandonné, mais signalé).
 */
export const remapWorkshopSkills = (
  workshop: Workshop,
  bundledSkills: BundledSkill[],
  schoolPrograms: SchoolProgram[]
): SkillRemapResult => {
  const skillIndex = buildSkillIndex(schoolPrograms);
  const localById = new Set(skillIndex.map(s => s.id));
  const localByName = new Map<string, string>(); // nom normalisé -> id local
  skillIndex.forEach(s => {
    const key = normalizeName(s.name);
    if (!localByName.has(key)) localByName.set(key, s.id);
  });

  const bundledById = new Map(bundledSkills.map(s => [s.id, s]));

  const resultIds: string[] = [];
  const seen = new Set<string>();
  let matchedById = 0;
  let matchedByName = 0;
  const unmatched: BundledSkill[] = [];

  for (const originalId of workshop.skillIds) {
    // 1. Match direct par ID
    if (localById.has(originalId)) {
      if (!seen.has(originalId)) {
        resultIds.push(originalId);
        seen.add(originalId);
      }
      matchedById++;
      continue;
    }

    // 2. Match par nom via la définition embarquée
    const def = bundledById.get(originalId);
    if (def) {
      const localId = localByName.get(normalizeName(def.name));
      if (localId) {
        if (!seen.has(localId)) {
          resultIds.push(localId);
          seen.add(localId);
        }
        matchedByName++;
        continue;
      }
      unmatched.push(def);
    } else {
      // Aucune définition embarquée et introuvable localement
      unmatched.push({ id: originalId, name: originalId, domainPath: '' });
    }
  }

  return { skillIds: resultIds, matchedById, matchedByName, unmatched };
};
