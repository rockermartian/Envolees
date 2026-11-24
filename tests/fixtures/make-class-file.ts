// Copie de tests/smoke/make-class-file.ts (application de bureau), chemins adaptés.
// Écrit une classe synthétique au format .envolees (même code que le processus principal).
// Usage (après bundling par tests/e2e/run.mjs) : node make-class-file.mjs <profil> <fichier> <dossier du programme>
import { writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { generateClass, ProfileName } from './syntheticClass';
import { buildArchive } from '../../app/shared/envoleesArchive.js';
import { prepareForSave } from '../../app/fileFormat/fileIO';
import { imageFileName } from '../../app/images/imageStore';

const [profile, outFile, projectRoot] = process.argv.slice(2);
const { data, images } = await generateClass(profile as ProfileName, projectRoot);
const { dataJson, refs } = await prepareForSave(data);
const { parts } = await buildArchive({
  dataJson, appVersion: 'test-fumee', deflateRaw: promisify(zlib.deflateRaw),
  images: refs.map(ref => ({ name: imageFileName(ref), bytes: images.get(ref)! })),
});
writeFileSync(outFile, Buffer.concat(parts));
console.log(`${outFile} : ${data.students.length} élèves, ${refs.length} images`);
