// Recopie dans web_app/core/ le code partagé avec l'application de bureau : règles métier (domain/),
// format des fichiers (fileFormat/, shared/), images, types. L'interface web est distincte : aucun
// composant de l'application de bureau n'est copié.
//
// La version web se déploie seule (dépôt GitHub indépendant) : elle ne peut pas importer le projet
// Electron, d'où cette copie (générée : ne pas la modifier à la main).
//
// Usage, après une modification du code partagé de l'application de bureau :
//     npm run sync                       (projet Electron = dossier parent)
//     npm run sync -- <chemin du projet> (projet Electron ailleurs)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const webApp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] ?? path.join(webApp, '..'));
const core = path.join(webApp, 'core');

if (!fs.existsSync(path.join(source, 'shared/envoleesArchive.js')) || !fs.existsSync(path.join(source, 'domain'))) {
    console.error(`Projet Electron introuvable dans ${source}. Usage : npm run sync -- <chemin du projet Electron>`);
    process.exit(1);
}

// Code partagé (sans interface) : il ne dépend que de react (useUndoRedo, StoredImage) et de jszip.
const CODE = ['types.ts', 'utils.ts', 'constants.ts', 'domain', 'fileFormat', 'images', 'shared', 'utils', 'hooks/useUndoRedo.ts'];
const PUBLIC = {
    'public/fonts.css': 'fonts.css',
    'public/Fonts/Poppins-Regular.ttf': 'Fonts/Poppins-Regular.ttf',
    'public/Fonts/Poppins-Medium.ttf': 'Fonts/Poppins-Medium.ttf',
    'public/Fonts/Poppins-SemiBold.ttf': 'Fonts/Poppins-SemiBold.ttf',
    'public/Fonts/Poppins-Bold.ttf': 'Fonts/Poppins-Bold.ttf',
};
const FIXTURES = {
    'programmes-competences-2025-sans-illustrations.competences': 'programmes-competences-2025-sans-illustrations.competences',
};

function copyTree(from, to) {
    if (fs.statSync(from).isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        for (const name of fs.readdirSync(from)) copyTree(path.join(from, name), path.join(to, name));
    } else {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
    }
}

fs.rmSync(core, { recursive: true, force: true });
for (const entry of CODE) copyTree(path.join(source, entry), path.join(core, entry));
for (const [from, to] of Object.entries(PUBLIC)) copyTree(path.join(source, from), path.join(webApp, 'public', to));
for (const [from, to] of Object.entries(FIXTURES)) copyTree(path.join(source, from), path.join(webApp, 'tests/fixtures', to));

// Version alignée sur l'application de bureau.
const sourcePkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
const pkgFile = path.join(webApp, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.version = sourcePkg.version;
fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

let origin = '';
try { origin = execSync('git log -1 --format="%h (%ci)"', { cwd: source, encoding: 'utf8' }).trim(); } catch { /* pas de dépôt git */ }
fs.writeFileSync(path.join(core, 'README.md'), `# Code partagé avec l'application de bureau — ne pas modifier ici

Copie générée par \`npm run sync\` (scripts/sync-desktop.mjs) depuis le projet Electron d'Envolées${origin ? `, commit ${origin}` : ''}, version ${sourcePkg.version}.
Règles métier, format des fichiers .envolees, client Nuage, images, types. Toute modification se fait dans le
projet Electron, puis \`npm run sync\`.
`);
console.log(`Code partagé à jour depuis ${source}${origin ? ` (${origin})` : ''} — version ${sourcePkg.version}`);
