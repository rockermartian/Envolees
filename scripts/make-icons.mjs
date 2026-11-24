// Génère les icônes PNG de l'application installable à partir des SVG (rendu par Electron/Chromium).
// Usage : npm run icons (depuis web_app/). Les PNG produits sont versionnés dans public/icons/.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.versions.electron) {
    // Lancé par Node : on relance ce script dans Electron.
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const { findElectron } = await import('./find-electron.mjs');
    const res = spawnSync(findElectron(), [fileURLToPath(import.meta.url)], { stdio: 'inherit', env });
    process.exit(res.status ?? 1);
} else {
    const { app, BrowserWindow } = createRequire(import.meta.url)('electron'); // module intégré d'Electron
    const icons = path.join(here, '../public/icons');
    const jobs = [
        { svg: path.join(icons, 'icon.svg'), out: 'icon-192.png', size: 192 },
        { svg: path.join(icons, 'icon.svg'), out: 'icon-512.png', size: 512 },
        { svg: path.join(here, 'maskable.svg'), out: 'maskable-512.png', size: 512 },
        { svg: path.join(here, 'maskable.svg'), out: 'apple-touch-icon.png', size: 180 },
    ];
    app.on('window-all-closed', () => undefined); // ne pas quitter entre deux icônes
    app.whenReady().then(async () => {
        for (const job of jobs) {
            const win = new BrowserWindow({ show: false, width: job.size, height: job.size, useContentSize: true, frame: false, transparent: true });
            const svg = fs.readFileSync(job.svg);
            const html = `<html><body style="margin:0;background:transparent;overflow:hidden"><img style="display:block;width:${job.size}px;height:${job.size}px" src="data:image/svg+xml;base64,${svg.toString('base64')}"></body></html>`;
            const page = path.join(os.tmpdir(), `envolees-icon-${job.size}-${path.basename(job.svg)}.html`);
            fs.writeFileSync(page, html);
            await win.loadFile(page);
            fs.rmSync(page);
            await new Promise(r => setTimeout(r, 300));
            const image = await win.webContents.capturePage();
            fs.writeFileSync(path.join(icons, job.out), image.resize({ width: job.size, height: job.size, quality: 'best' }).toPNG());
            console.log(`${job.out} (${job.size}px)`);
            win.destroy();
        }
        app.quit();
    });
}
