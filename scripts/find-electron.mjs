// Electron sert d'outil de test (Chromium piloté) et de rendu des icônes. Ce n'est pas une
// dépendance de la version web : on l'utilise s'il est installé (ici ou dans le projet Electron
// voisin), ou via ELECTRON_PATH. Sinon : npm install --no-save electron
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webApp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function findElectron() {
    if (process.env.ELECTRON_PATH) return process.env.ELECTRON_PATH;
    for (const base of [webApp, path.join(webApp, '..')]) {
        try { return createRequire(path.join(base, 'package.json'))('electron'); } catch { /* suivant */ }
    }
    console.error("Electron introuvable. Installez-le pour ces outils : npm install --no-save electron (ou ELECTRON_PATH=<exécutable>).");
    process.exit(1);
}
