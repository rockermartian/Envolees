// Test de bout en bout de la version web dans un vrai Chromium (celui d'Electron, déjà installé),
// fenêtre masquée. Lancé par run.mjs avec un scénario : desktop | mobile.
//
// Le navigateur est piloté comme un utilisateur : clics sur les libellés, sélecteur de fichiers
// intercepté (protocole DevTools), téléchargements capturés, impression simulée.
import electron from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { app, BrowserWindow, session } = electron;
const scenario = process.argv.at(-1);
const URL_BASE = process.env.E2E_URL;
const FIXTURE = process.env.E2E_FILE;
const EXPECT = process.env.E2E_EXPECT;
const PNG = process.env.E2E_PNG;
const SHOTS = process.env.E2E_SHOTS;
const REAL_IMAGES = process.env.E2E_REAL_IMAGES === '1';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `envolees-web-e2e-${scenario}-`));
app.setPath('userData', path.join(tmp, 'userData'));
app.on('window-all-closed', () => undefined);

const finish = () => {
    for (const r of results) console.log(`${r.ok ? 'OK ' : 'KO '} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    const failed = results.filter(r => !r.ok).length;
    console.log(`E2E ${scenario}: ${results.length - failed}/${results.length}`);
    app.exit(failed ? 1 : 0);
};
setTimeout(() => { check('terminé dans les délais', false); finish(); }, 240_000);

let win;
const js = code => win.webContents.executeJavaScript(code, true);
async function waitFor(label, code, timeout = 20_000) {
    if (process.env.E2E_DEBUG) console.log('…', label);
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try { const v = await js(code); if (v) return v; } catch { /* page en cours de chargement */ }
        await wait(100);
    }
    throw new Error(`délai dépassé : ${label}`);
}
const text = () => js('document.body.innerText');
/** Clique le premier élément (sélecteur) dont le texte ou l'aria-label contient `label`. */
const click = (label, selector = 'button, [role=button], a, label') => js(`(() => {
    const want = ${JSON.stringify(label)}.toLowerCase(); // innerText suit text-transform
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
        .find(e => (e.innerText || '').toLowerCase().includes(want) || (e.getAttribute('aria-label') || '').toLowerCase().includes(want));
    if (!el) return false;
    el.click();
    return true;
})()`).then(ok => { if (!ok) throw new Error(`introuvable : « ${label} »`); });
const shot = async name => {
    if (!SHOTS) return;
    win.webContents.invalidate(); // fenêtre masquée : forcer un rendu à jour avant la capture
    await wait(600);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SHOTS, `${scenario}-${name}.png`), image.toPNG());
};
/** Lecture directe de la base du navigateur (contrôle de ce qui est réellement enregistré). */
const readDb = () => js(`new Promise((resolve, reject) => {
    const r = indexedDB.open('envolees');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction(['classes', 'images'], 'readonly');
        const classes = tx.objectStore('classes').getAll();
        const images = tx.objectStore('images').getAllKeys();
        tx.oncomplete = () => resolve({
            classes: classes.result.map(c => ({ id: c.id, name: c.name, updatedAt: c.updatedAt, images: c.images.length, acquired: (c.dataJson.match(/"proficiency":"Acquis"/g) || []).length, dark: c.dataJson.includes('"theme":"dark"'), dataJson: c.dataJson.length })),
            images: images.result.length,
        });
    };
})`);

// Sélecteur de fichiers : intercepté, le fichier voulu est fourni directement.
const fileQueue = [];
// Téléchargements : enregistrés dans le dossier temporaire.
const downloads = [];

async function setup(width, height) {
    const ses = session.fromPartition('persist:e2e');
    ses.on('will-download', (_e, item) => {
        const target = path.join(tmp, item.getFilename());
        item.setSavePath(target);
        item.once('done', (_ev, state) => downloads.push({ path: target, state }));
    });
    if (process.env.E2E_DEBUG) console.log('… fenêtre');
    win = new BrowserWindow({ show: false, width, height, webPreferences: { session: ses } });
    const consoleErrors = [];
    win.webContents.on('console-message', (event, legacyLevel, legacyMessage) => {
        const level = event.level ?? legacyLevel;
        const message = event.message ?? legacyMessage;
        if (level === 'error' || level === 3) consoleErrors.push(message);
    });
    await win.loadURL('about:blank'); // le protocole DevTools répond une fois la page créée
    const dbg = win.webContents.debugger;
    dbg.attach('1.3');
    if (process.env.E2E_DEBUG) console.log('… devtools');
    await dbg.sendCommand('Page.enable');
    await dbg.sendCommand('DOM.enable');
    await dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true });
    // Pas de sélecteur natif (File System Access) : chemin « input file », pilotable. Impression simulée.
    await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `
        delete window.showOpenFilePicker; delete window.showSaveFilePicker;
        window.__printed = 0;
        window.print = () => { window.__printed++; window.dispatchEvent(new Event('afterprint')); };
    ` });
    dbg.on('message', async (_e, method, params) => {
        if (method !== 'Page.fileChooserOpened') return;
        const file = fileQueue.shift();
        if (!file) return;
        await dbg.sendCommand('DOM.setFileInputFiles', { files: [file], backendNodeId: params.backendNodeId });
    });
    return consoleErrors;
}

const waitDownload = async (count, label) => {
    await waitFor(label, 'true', 1); // laisse le temps au clic
    const start = Date.now();
    while (downloads.length < count && Date.now() - start < 60_000) await wait(100);
    const d = downloads[count - 1];
    if (!d || d.state !== 'completed') throw new Error(`téléchargement non terminé : ${label}`);
    return d.path;
};

/** Lit un fichier .envolees avec le lecteur partagé (application de bureau). */
async function readEnvolees(file) {
    const { readArchive } = await import('../../../shared/envoleesArchive.js');
    const zlib = await import('node:zlib');
    const { promisify } = await import('node:util');
    return readArchive(new Uint8Array(fs.readFileSync(file)), promisify(zlib.inflateRaw));
}

const imageVisible = () => js(`[...document.images].some(i => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0)`);

// ---------------------------------------------------------------------------------------------

async function desktop() {
    const consoleErrors = await setup(1366, 860);
    await win.loadURL(`${URL_BASE}?ui=desktop`);
    await waitFor('écran d\'accueil', `document.body.innerText.includes('Bienvenue sur Envolées')`);
    check('interface ordinateur : écran d\'accueil de l\'application de bureau', true);
    check('boutons de fenêtre Electron masqués', await js(`[...document.querySelectorAll('svg rect[width="10"][height="1"]')].every(r => r.getBoundingClientRect().width === 0)`));
    await shot('accueil');

    // Ouvrir un fichier .envolees
    await click('Ouvrir une classe');
    await waitFor('boîte « Ouvrir »', `!!document.querySelector('#platform-root [role=dialog]')`);
    fileQueue.push(FIXTURE);
    let t = Date.now();
    await click('Ouvrir un fichier .envolees');
    await waitFor('classe affichée', `document.body.innerText.includes(${JSON.stringify(EXPECT)}) && !document.querySelector('#platform-root [role=dialog]')`, 120_000);
    const openMs = Date.now() - t;
    const original = await readEnvolees(FIXTURE);
    check('fichier .envolees ouvert', true, `${(fs.statSync(FIXTURE).size / 1e6).toFixed(0)} Mo, ${original.images.size} images, ${openMs} ms`);
    let db = await readDb();
    check("message d'attente refermé", await waitFor("fin du message d'attente", `!document.querySelector('#platform-root [aria-busy]')`, 5000).then(() => true, () => false));
    check('classe et images rangées dans le navigateur', db.classes.length === 1 && db.classes[0].images === original.images.size && db.images >= original.images.size, `${db.classes[0]?.images} images`);
    if (REAL_IMAGES) {
        await waitFor('photos affichées', `[...document.images].some(i => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0)`, 20_000).catch(() => null);
        check('photos affichées (URL blob)', await imageVisible());
    }
    await shot('classe');

    // Modification puis enregistrement (clic sur l'indicateur)
    const before = db.classes[0].updatedAt;
    await click('Changer le thème');
    await waitFor('modification signalée', `!!document.querySelector('button[aria-label^="Modifications non enregistrées"]')`);
    t = Date.now();
    await click('Modifications non enregistrées');
    await waitFor('enregistré', `!!document.querySelector('button[aria-label="Tout est enregistré"]')`, 60_000);
    const saveMs = Date.now() - t;
    db = await readDb();
    const originalTheme = JSON.parse(original.dataJson).uiSettings.theme;
    check('enregistrement dans le navigateur', db.classes[0].updatedAt > before && db.classes[0].dark === (originalTheme !== 'dark'), `${saveMs} ms`);

    // Enregistrer sous › Télécharger
    await click('Menu');
    await click('Enregistrer sous');
    await waitFor('boîte « Enregistrer sous »', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Exporter un fichier .envolees')`);
    t = Date.now();
    await click('Télécharger le fichier');
    const exported = await waitDownload(1, 'export');
    const back = await readEnvolees(exported);
    const sameImages = [...original.images.keys()].every(name => back.images.has(name) && Buffer.compare(Buffer.from(back.images.get(name).bytes), Buffer.from(original.images.get(name).bytes)) === 0);
    check('fichier exporté relu par le lecteur de bureau, images identiques', sameImages && JSON.parse(back.dataJson).students.length === JSON.parse(original.dataJson).students.length,
        `${(fs.statSync(exported).size / 1e6).toFixed(0)} Mo en ${Date.now() - t} ms, app ${back.manifest.app}`);
    check('thème modifié présent dans le fichier exporté', JSON.parse(back.dataJson).uiSettings.theme !== originalTheme);

    // Livret : impression du navigateur
    const printing = js(`window.electronAPI.generateLivretPdf()`);
    await waitFor('message « Exporter en PDF »', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Enregistrer au format PDF')`);
    await click('OK', '#platform-root button');
    const printed = await printing;
    check('PDF : impression du navigateur lancée', printed.success && (await js('window.__printed')) === 1);

    // Persistance : rechargement, « Reprendre la dernière session »
    await win.webContents.reload();
    await waitFor('accueil après rechargement', `document.body.innerText.includes('Reprendre la dernière session')`);
    await click('Reprendre la dernière session');
    await waitFor('classe rouverte', `document.body.innerText.includes(${JSON.stringify(EXPECT)})`, 60_000);
    check('classe retrouvée après rechargement', true);

    // Hors ligne : service worker
    const sw = await waitFor('service worker actif', `navigator.serviceWorker.ready.then(r => !!r.active && caches.keys()).then(k => k && k.length)`, 30_000).catch(() => 0);
    check('service worker actif, fichiers en cache', sw > 0);
    win.webContents.session.enableNetworkEmulation({ offline: true });
    await win.webContents.reload();
    await waitFor('accueil hors ligne', `document.body.innerText.includes('Reprendre la dernière session')`, 20_000).then(() => true, () => false)
        .then(ok => check('application utilisable hors ligne', ok));
    await click('Reprendre la dernière session').catch(() => undefined);
    await waitFor('classe hors ligne', `document.body.innerText.includes(${JSON.stringify(EXPECT)})`, 60_000).then(() => true, () => false)
        .then(ok => check('classe ouverte hors ligne', ok));
    win.webContents.session.disableNetworkEmulation();

    const errors = consoleErrors.filter(m => !/favicon|Download the React DevTools/.test(m));
    check('aucune erreur dans la console', errors.length === 0, errors.slice(0, 3).join(' | '));
}

async function mobile() {
    const consoleErrors = await setup(390, 844);
    await win.loadURL(`${URL_BASE}?ui=mobile`);
    await waitFor('accueil mobile', `[...document.querySelectorAll('button')].some(b => b.innerText.includes('Ouvrir un fichier .envolees') && !b.disabled)`);
    check('interface mobile : accueil', true);
    await shot('1-accueil');

    fileQueue.push(FIXTURE);
    let t = Date.now();
    await click('Ouvrir un fichier .envolees');
    await waitFor('liste des élèves', `document.body.innerText.includes(${JSON.stringify(EXPECT)}) && !!document.querySelector('nav')`, 120_000);
    check('fichier .envolees ouvert sur mobile', true, `${Date.now() - t} ms`);
    check("message d'attente refermé (mobile)", await waitFor("fin du message d'attente", `!document.querySelector('#platform-root [aria-busy]')`, 5000).then(() => true, () => false));
    if (REAL_IMAGES) {
        await waitFor('photos', `[...document.images].some(i => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0)`, 20_000).catch(() => null);
        check('photos des élèves affichées', await imageVisible());
    }
    check('pas de défilement horizontal', await js('document.documentElement.scrollWidth <= window.innerWidth'));
    await shot('2-eleves');

    // Fiche élève, validation en un geste
    await click(EXPECT, 'ul button');
    await waitFor('fiche élève', `document.body.innerText.includes('À valider') && document.body.innerText.includes('Rechercher une compétence') === false`, 10_000).catch(() => null);
    await waitFor('fiche élève (domaines)', `document.querySelectorAll('section > button[aria-expanded]').length > 0`);
    await js(`document.querySelector('section > button[aria-expanded]').click()`);
    await waitFor('compétences du domaine', `!!document.querySelector('button[aria-label^="Valider "]')`);
    await shot('3-fiche');
    let db = await readDb();
    const acquiredBefore = db.classes[0].acquired;
    await js(`document.querySelector('button[aria-label^="Valider "]').click()`);
    await waitFor('message de validation', `document.body.innerText.includes('validée pour')`);
    await wait(1500);
    db = await readDb();
    check('validation en un geste enregistrée aussitôt', db.classes[0].acquired === acquiredBefore + 1, `${acquiredBefore} → ${db.classes[0].acquired}`);
    await click('Annuler', '[role=status] button');
    await wait(1500);
    db = await readDb();
    check('« Annuler » retire la validation', db.classes[0].acquired === acquiredBefore);

    // Validation avec photo (fichier image → compression WebP → magasin)
    await js(`[...document.querySelectorAll('li button')].find(b => !b.getAttribute('aria-label') && b.closest('section')).click()`);
    await waitFor('feuille de validation', `document.body.innerText.includes('Photo de preuve')`);
    fileQueue.push(PNG);
    const imagesBefore = db.images;
    await click('Choisir', '[role=dialog] button');
    await waitFor('photo ajoutée', `!!document.querySelector('[role=dialog] img[alt="Photo de preuve"]')`, 15_000);
    await shot('4-validation-photo');
    await click('Valider', '[role=dialog] button.min-h-12');
    await wait(1500);
    db = await readDb();
    check('validation avec photo prise sur le téléphone', db.classes[0].acquired === acquiredBefore + 1 && db.images === imagesBefore + 1, `${db.images - imagesBefore} image ajoutée`);

    // Retour, validation groupée
    await click('Retour');
    await click('Valider', 'nav button');
    await click('Choisir les compétences');
    await waitFor('liste des compétences', `document.querySelectorAll('[role=dialog] input[type=checkbox]').length > 0`);
    await js(`document.querySelectorAll('[role=dialog] input[type=checkbox]')[3].click()`);
    await click('Terminé');
    await click('Tous');
    await shot('5-validation-groupee');
    const beforeMass = (await readDb()).classes[0].acquired;
    await js(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('Valider pour')).click()`);
    await waitFor('message de validation groupée', `document.body.innerText.includes('enregistrée')`);
    await wait(1500);
    const afterMass = (await readDb()).classes[0].acquired;
    check('validation groupée enregistrée', afterMass > beforeMass, `+${afterMass - beforeMass}`);

    await click('Ateliers', 'nav button');
    await waitFor('ateliers', `document.body.innerText.includes('Journal')`);
    await shot('6-ateliers');

    // Export du fichier (téléchargement ; le partage n'existe pas dans ce navigateur de test)
    await click('Plus', 'nav button');
    await waitFor('onglet Plus', `document.body.innerText.includes('Version ordinateur')`);
    await shot('7-plus');
    t = Date.now();
    await click('fichier .envolees');
    const exported = await waitDownload(1, 'export mobile');
    const back = await readEnvolees(exported);
    const original = await readEnvolees(FIXTURE);
    check('fichier exporté depuis le téléphone : photo ajoutée incluse', back.images.size === original.images.size + 1, `${back.images.size} images, ${Date.now() - t} ms`);

    await click('Changer de classe');
    await waitFor('retour à l\'accueil', `document.body.innerText.includes('Mes classes')`);
    check('retour à l\'accueil, classe listée', await waitFor('classe listée', `!!document.querySelector('[data-class-id]')`).then(() => true, () => false));

    check('pas de défilement horizontal (fin)', await js('document.documentElement.scrollWidth <= window.innerWidth'));
    const errors = consoleErrors.filter(m => !/favicon|Download the React DevTools/.test(m));
    check('aucune erreur dans la console', errors.length === 0, errors.slice(0, 3).join(' | '));
}

app.whenReady().then(async () => {
    try {
        await (scenario === 'mobile' ? mobile() : desktop());
    } catch (error) {
        check('scénario complet', false, error.message);
        await shot('erreur').catch(() => undefined);
        console.log((await text().catch(() => '')).slice(0, 1500));
    }
    finish();
});
