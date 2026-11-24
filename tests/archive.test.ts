import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildArchive, readArchive } from '../../shared/envoleesArchive.js';
import { crc32 } from '../../shared/zip.js';
import { imageFileName } from '../../images/imageStore';
import { collectImageRefs, parseOpenedData, prepareForSave } from '../../fileFormat/fileIO';
import { generateClass } from '../../tests/fixtures/syntheticClass';
import { buildEnvoleesBlob, readEnvoleesFile, type ArchiveImageBlob } from '../src/platform/archive';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const nodeInflate = promisify(zlib.inflateRaw);
const nodeDeflate = promisify(zlib.deflateRaw);
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const PHOTO = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
const OTHER = new Uint8Array(1000).map((_, i) => i % 251);
const imageBlob = (name: string, bytes: Uint8Array): ArchiveImageBlob =>
    ({ name, blob: new Blob([bytes], { type: 'image/webp' }), crc32: crc32(bytes) });

describe('archive .envolees écrite par la version web', () => {
    it('lisible par le lecteur partagé (application de bureau) et par une bibliothèque standard', async () => {
        const blob = await buildEnvoleesBlob('{"students":[]}', [imageBlob('aa.webp', PHOTO), imageBlob('bb.webp', OTHER)], 'test-web');
        const buf = await bytesOf(blob);

        const read = await readArchive(buf, nodeInflate);
        expect(read.manifest).toMatchObject({ format: 'envolees', schema: 2, app: 'test-web' });
        expect(read.dataJson).toBe('{"students":[]}');
        expect(read.images.get('aa.webp')!.bytes).toEqual(PHOTO);
        expect(read.images.get('bb.webp')!.bytes).toEqual(OTHER);

        const zip = await JSZip.loadAsync(buf, { checkCRC32: true });
        expect(await zip.file('images/bb.webp')!.async('uint8array')).toEqual(OTHER);
        expect(await zip.file('data.json')!.async('string')).toBe('{"students":[]}');
    });
});

describe('archive écrite par l\'application de bureau, lue par la version web', () => {
    it('images = tranches du fichier (pas de copie), octets et CRC identiques', async () => {
        const { parts } = await buildArchive({
            dataJson: '{"x":1}', appVersion: 'desktop', deflateRaw: nodeDeflate,
            images: [{ name: 'aa.webp', bytes: PHOTO }, { name: 'bb.webp', bytes: OTHER }],
        });
        const file = new Blob(parts as BlobPart[]);
        const { dataJson, images } = await readEnvoleesFile(file);
        expect(dataJson).toBe('{"x":1}');
        const byName = new Map(images.map(i => [i.name, i]));
        expect(await bytesOf(byName.get('bb.webp')!.blob)).toEqual(OTHER);
        expect(byName.get('bb.webp')!.blob.type).toBe('image/webp');
        expect(byName.get('aa.webp')!.crc32).toBe(crc32(PHOTO));
    });

    it('fichier qui n\'est pas une classe : message en français', async () => {
        await expect(readEnvoleesFile(new Blob(['bonjour']))).rejects.toThrow(/pas un fichier de classe/);
    });
});

describe('performance — classe très lourde (32 élèves, ≈ 4 500 photos, ≈ 170 Mo)', () => {
    it('écriture puis relecture en moins de 3 s chacune, contenu identique', async () => {
        const { data, images } = await generateClass('tres_lourd', ROOT);
        const { dataJson, refs } = await prepareForSave(data);
        const entries = refs.map(ref => imageBlob(imageFileName(ref), images.get(ref)!));

        let t = performance.now();
        const blob = await buildEnvoleesBlob(dataJson, entries, 'perf');
        const writeMs = performance.now() - t;

        t = performance.now();
        const read = await readEnvoleesFile(blob);
        parseOpenedData(read.dataJson);
        const readMs = performance.now() - t;

        console.log(`version web : ${(blob.size / 1e6).toFixed(0)} Mo, ${entries.length} images · écriture ${writeMs.toFixed(0)} ms · lecture ${readMs.toFixed(0)} ms`);
        expect(read.images.length).toBe(collectImageRefs(data).length);
        const sample = read.images[Math.floor(read.images.length / 2)];
        expect(await bytesOf(sample.blob)).toEqual(images.get(`img:${sample.name}`));
        expect(writeMs).toBeLessThan(3000);
        expect(readMs).toBeLessThan(3000);
    }, 120_000);
});
