// Recopie dans web_app/ le code de l'application de bureau dont la version web a besoin.
//
// La version web se déploie seule (dépôt GitHub indépendant) : elle ne peut pas importer le projet
// Electron. Elle en garde donc une copie dans app/ (générée : ne pas la modifier à la main).
//
// Usage, après une modification de l'application de bureau :
//     npm run sync                       (projet Electron = dossier parent)
//     npm run sync -- <chemin du projet> (projet Electron ailleurs)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const webApp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] ?? path.join(webApp, '..'));
const app = path.join(webApp, 'app');

if (!fs.existsSync(path.join(source, 'App.tsx')) || !fs.existsSync(path.join(source, 'shared/envoleesArchive.js'))) {
    console.error(`Projet Electron introuvable dans ${source}. Usage : npm run sync -- <chemin du projet Electron>`);
    process.exit(1);
}

// Code de l'interface et règles métier (tout ce qu'importe App.tsx).
const CODE = ['App.tsx', 'types.ts', 'utils.ts', 'constants.ts', 'index.css', 'components', 'domain', 'fileFormat', 'hooks', 'images', 'shared', 'utils'];
// Fichiers publics : polices utilisées et guide.
const PUBLIC = {
    'public/fonts.css': 'fonts.css',
    'public/Fonts/Poppins-Regular.ttf': 'Fonts/Poppins-Regular.ttf',
    'public/Fonts/Poppins-Medium.ttf': 'Fonts/Poppins-Medium.ttf',
    'public/Fonts/Poppins-SemiBold.ttf': 'Fonts/Poppins-SemiBold.ttf',
    'public/Fonts/Poppins-Bold.ttf': 'Fonts/Poppins-Bold.ttf',
    'guide/index.html': 'guide/index.html',
};
// Données de test.
const FIXTURES = { 'programmes-competences-2025-sans-illustrations.competences': 'programmes-competences-2025-sans-illustrations.competences' };

// La version vient de package.json via import.meta.env (aucune déclaration globale à ajouter).
const transform = (file, text) => (/\.(tsx?)$/.test(file) ? text.replaceAll('__APP_VERSION__', 'import.meta.env.VITE_APP_VERSION') : text);

function copyTree(from, to) {
    const stat = fs.statSync(from);
    if (stat.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        for (const name of fs.readdirSync(from)) copyTree(path.join(from, name), path.join(to, name));
        return 1;
    }
    if (/\.(ts|tsx|js|css)$/.test(from)) fs.writeFileSync(to, transform(from, fs.readFileSync(from, 'utf8')));
    else fs.copyFileSync(from, to);
    return 1;
}

fs.rmSync(app, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });
for (const entry of CODE) copyTree(path.join(source, entry), path.join(app, entry));

// Styles de base de l'interface de bureau : bloc <style> de son index.html.
const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
const style = /<style>([\s\S]*?)<\/style>/.exec(html);
if (!style) throw new Error("Bloc <style> introuvable dans l'index.html de l'application de bureau");
fs.writeFileSync(path.join(app, 'desktop-styles.css'), `/* Copie du bloc <style> d'index.html (application de bureau). Fichier généré. */\n${style[1].trim()}\n`);

for (const [from, to] of Object.entries(PUBLIC)) {
    const target = path.join(webApp, 'public', to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, from), target);
}
for (const [from, to] of Object.entries(FIXTURES)) {
    fs.mkdirSync(path.join(webApp, 'tests/fixtures'), { recursive: true });
    fs.copyFileSync(path.join(source, from), path.join(webApp, 'tests/fixtures', to));
}

// Version et dépendances alignées sur l'application de bureau.
const sourcePkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
const pkgFile = path.join(webApp, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.version = sourcePkg.version;
for (const field of ['dependencies', 'devDependencies']) {
    for (const name of Object.keys(pkg[field] ?? {})) {
        const wanted = sourcePkg.dependencies?.[name] ?? sourcePkg.devDependencies?.[name];
        if (wanted) pkg[field][name] = wanted;
    }
}
fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

let origin = '';
try { origin = execSync('git log -1 --format="%h (%ci)"', { cwd: source, encoding: 'utf8' }).trim(); } catch { /* pas de dépôt git */ }
fs.writeFileSync(path.join(app, 'README.md'), `# Copie de l'application de bureau — ne pas modifier ici

Ce dossier est généré par \`npm run sync\` (scripts/sync-desktop.mjs) à partir du projet Electron
d'Envolées${origin ? `, commit ${origin}` : ''}, version ${sourcePkg.version}.

Toute modification se fait dans le projet Electron, puis \`npm run sync\` met cette copie à jour.
Seule transformation : \`__APP_VERSION__\` devient \`import.meta.env.VITE_APP_VERSION\`.
`);

console.log(`Copie à jour depuis ${source}${origin ? ` (${origin})` : ''} — version ${sourcePkg.version}`);
