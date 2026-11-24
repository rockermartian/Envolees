// Import d'un programme de compétences (.competences), comme dans l'onglet Compétences sur ordinateur :
// JSON (programme fourni) ou archive ZIP (data.json + illustrations).
import JSZip from 'jszip';
import { normalizePrograms } from '../../core/fileFormat/normalize';
import { importImageFromZip } from '../../core/images/imageArchive';
import type { Domain, SchoolProgram } from '../../core/types';

export async function readProgramFile(file: Blob): Promise<SchoolProgram[]> {
    const buffer = await file.arrayBuffer();
    const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
    let zip: JSZip | null = null;
    let raw: unknown;
    if (head[0] === 0x50 && head[1] === 0x4b) {
        zip = await JSZip.loadAsync(buffer);
        const dataFile = zip.file('data.json');
        if (!dataFile) throw new Error("Ce fichier n'est pas un programme de compétences (data.json manquant).");
        raw = JSON.parse(await dataFile.async('string'));
    } else {
        try { raw = JSON.parse(new TextDecoder().decode(buffer)); } catch { throw new Error("Ce fichier n'est pas un programme de compétences lisible."); }
    }
    if (!Array.isArray(raw)) throw new Error("Ce fichier n'est pas un programme de compétences.");
    const programs = normalizePrograms(raw as SchoolProgram[]);
    const restore = async (domains: Domain[]) => {
        for (const domain of domains) {
            for (const skill of domain.skills) if (skill.image) skill.image = await importImageFromZip(zip, skill.image);
            await restore(domain.subDomains);
        }
    };
    for (const program of programs) await restore(program.domains);
    return programs;
}
