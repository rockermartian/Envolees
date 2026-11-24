// Lance les tests de bout en bout de la version web (après `vite build`) : npm run test:e2e
//   - sert dist/ sous un sous-chemin, comme GitHub Pages (https://<compte>.github.io/<dépôt>/) ;
//   - ouvre l'application dans le Chromium d'Electron : interface ordinateur, puis interface mobile.
// Fichier de classe : E2E_FILE, sinon ../classe-test-lourde.envolees (projet Electron) s'il existe
// (vraies photos), sinon une classe synthétique générée.
// Captures d'écran : E2E_SHOTS=<dossier>.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { build } from 'esbuild';
import { readArchive } from '../../app/shared/envoleesArchive.js';
import { findElectron } from '../../scripts/find-electron.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webApp = path.resolve(here, '../..');
const fixtures = path.join(webApp, 'tests/fixtures');
const dist = path.join(webApp, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ absent : lancer `npm run build` d\'abord.'); process.exit(1); }

// --- Fichier de classe de test ---
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'envolees-web-fixture-'));
// Classe de test lourde du projet Electron voisin, si web_app est encore à l'intérieur.
let fixture = process.env.E2E_FILE ?? path.join(webApp, '..', 'classe-test-lourde.envolees');
let realImages = process.env.E2E_FILE ? process.env.E2E_REAL_IMAGES === '1' : fs.existsSync(fixture);
if (!fs.existsSync(fixture)) {
    const generator = path.join(work, 'make-class-file.mjs');
    await build({ entryPoints: [path.join(fixtures, 'make-class-file.ts')], bundle: true, platform: 'node', format: 'esm', outfile: generator, logLevel: 'error' });
    fixture = path.join(work, 'classe-moyenne.envolees');
    const gen = spawnSync(process.execPath, [generator, 'moyen', fixture, fixtures], { encoding: 'utf8' });
    if (gen.status !== 0) { console.error(gen.stderr); process.exit(1); }
    realImages = false;
}
const { dataJson } = await readArchive(new Uint8Array(fs.readFileSync(fixture)), promisify(zlib.inflateRaw));
const first = JSON.parse(dataJson).students[0];
const expected = `${first.firstName} ${first.lastName}`;
console.log(`Classe de test : ${path.basename(fixture)} (${(fs.statSync(fixture).size / 1e6).toFixed(0)} Mo), élève attendu « ${expected} »${realImages ? ', vraies photos' : ''}`);

// --- Serveur statique (sous-chemin /envolees/, comme GitHub Pages) ---
const BASE = '/envolees/';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
    let file = path.join(dist, decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html');
    if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}${BASE}`;

// --- Scénarios ---
const electronPath = findElectron();
const env = { ...process.env, E2E_URL: url, E2E_FILE: fixture, E2E_EXPECT: expected, E2E_PNG: path.join(webApp, 'public/icons/icon-512.png'), E2E_REAL_IMAGES: realImages ? '1' : '0' };
delete env.ELECTRON_RUN_AS_NODE; // défini dans les terminaux VS Code : Electron se comporterait comme Node
if (env.E2E_SHOTS) fs.mkdirSync(env.E2E_SHOTS, { recursive: true });

let failed = 0;
for (const scenario of ['desktop', 'mobile']) {
    const res = await new Promise(resolve => {
        const child = spawn(electronPath, [path.join(here, 'browser.mjs'), scenario], { env });
        let out = '';
        child.stdout.on('data', d => { out += d; });
        child.stderr.on('data', d => { out += d; });
        // Erreur au chargement du script : Electron resterait ouvert. Délai de sécurité.
        const timer = setTimeout(() => { out += '\nKO  délai global dépassé'; child.kill(); }, 300_000);
        child.on('close', status => { clearTimeout(timer); resolve({ status, out }); });
    });
    const lines = res.out.split(/\r?\n/).filter(l => /^(OK|KO|E2E)/.test(l));
    console.log(lines.join('\n') || `E2E ${scenario}: aucun résultat\n${res.out.slice(-3000)}`);
    if (res.status !== 0 || !lines.length) {
        failed++;
        const extra = res.out.split(/\r?\n/).filter(l => l && !/^(OK|KO|E2E)/.test(l) && !/^\[\d+:/.test(l)).slice(0, 40);
        if (extra.length) console.log(extra.join('\n'));
    }
}
server.close();
fs.rmSync(work, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

