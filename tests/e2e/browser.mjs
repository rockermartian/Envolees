// Test de bout en bout de la version web dans un vrai Chromium (celui d'Electron), fenêtre masquée.
// Lancé par run.mjs avec un scénario : ordinateur | tablette.
//   - ordinateur : souris et clavier, grand écran (liste et fiche côte à côte) ;
//   - tablette : toucher réel (évènements tactiles du protocole DevTools), portrait puis paysage,
//     contrôle de la taille des cibles tactiles.
// Sélecteur de fichiers intercepté, téléchargements capturés, onglets ouverts (Nuage) relevés.
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
// Caméra simulée par Chromium (mode élève), autorisée sans demande.
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.on('window-all-closed', () => undefined);

const finish = () => {
    for (const r of results) console.log(`${r.ok ? 'OK ' : 'KO '} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    const failed = results.filter(r => !r.ok).length;
    console.log(`E2E ${scenario}: ${results.length - failed}/${results.length}`);
    app.exit(failed ? 1 : 0);
};
setTimeout(() => { check('terminé dans les délais', false); finish(); }, 280_000);

let win;
let dbg;
const js = code => win.webContents.executeJavaScript(code, true);
async function waitFor(label, code, timeout = 20_000) {
    const start = Date.now();
    do {
        try { const v = await js(code); if (v) return v; } catch { /* page en cours de chargement */ }
        await wait(100);
    } while (Date.now() - start < timeout);
    throw new Error(`délai dépassé : ${label}`);
}
const text = () => js('document.body.innerText');

/** Élément visible dont le texte ou l'aria-label contient `label` (insensible à la casse). */
const FIND = (label, selector) => `(() => {
    const want = ${JSON.stringify(label)}.toLowerCase();
    return [...document.querySelectorAll(${JSON.stringify(selector)})]
        .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .find(e => (e.innerText || '').toLowerCase().includes(want) || (e.getAttribute('aria-label') || '').toLowerCase().includes(want));
})()`;
const DEFAULT_SELECTOR = 'button, [role=button], [role=radio], a, label';

/** Clic souris (ordinateur). */
const click = async (label, selector = DEFAULT_SELECTOR) => {
    const ok = await js(`(() => { const el = ${FIND(label, selector)}; if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`introuvable : « ${label} »`);
};

/** Tape au doigt (tablette) : vrais évènements tactiles au centre de l'élément. */
const tap = async (label, selector = DEFAULT_SELECTOR) => {
    const rect = await js(`(() => { const el = ${FIND(label, selector)}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!rect) throw new Error(`introuvable (toucher) : « ${label} »`);
    const point = [{ x: Math.round(rect.x), y: Math.round(rect.y) }];
    await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
    await wait(40);
    await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(120);
};

const shot = async name => {
    if (!SHOTS) return;
    win.webContents.invalidate();
    await wait(600);
    fs.writeFileSync(path.join(SHOTS, `${scenario}-${name}.png`), (await win.webContents.capturePage()).toPNG());
};

/** Lecture directe de la base du navigateur (ce qui est réellement enregistré). */
const readDb = () => js(`new Promise((resolve, reject) => {
    const r = indexedDB.open('envolees');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
        const tx = r.result.transaction(['classes', 'images'], 'readonly');
        const classes = tx.objectStore('classes').getAll();
        const images = tx.objectStore('images').getAllKeys();
        tx.oncomplete = () => resolve({
            classes: classes.result.map(c => ({ id: c.id, name: c.name, acquired: (c.dataJson.match(/"proficiency":"Acquis"/g) || []).length, images: c.images.length })),
            images: images.result.length,
        });
    };
})`);

const fileQueue = [];
const downloads = [];
const openedTabs = [];
let consoleErrors = [];

async function setup(width, height, { touch = false } = {}) {
    const ses = session.fromPartition(`persist:e2e-${scenario}`);
    ses.on('will-download', (_e, item) => {
        const target = path.join(tmp, item.getFilename());
        item.setSavePath(target);
        item.once('done', (_ev, state) => downloads.push({ path: target, state }));
    });
    win = new BrowserWindow({ show: false, width, height, useContentSize: true, webPreferences: { session: ses } });
    win.webContents.setWindowOpenHandler(({ url }) => { openedTabs.push(url); return { action: 'deny' }; });
    win.webContents.on('console-message', (event, legacyLevel, legacyMessage) => {
        const level = event.level ?? legacyLevel;
        const message = event.message ?? legacyMessage;
        if (level === 'error' || level === 3) consoleErrors.push(message);
    });
    await win.loadURL('about:blank'); // le protocole DevTools répond une fois la page créée
    dbg = win.webContents.debugger;
    dbg.attach('1.3');
    await dbg.sendCommand('Page.enable');
    await dbg.sendCommand('DOM.enable');
    await dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true });
    if (touch) {
        await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await dbg.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }] }).catch(() => undefined);
    }
    // Sélecteur de fichiers « classique » (pilotable) ; impression simulée.
    await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `
        delete window.showOpenFilePicker; delete window.showSaveFilePicker;
        window.print = () => { window.__printed = (window.__printed || 0) + 1; };
    ` });
    dbg.on('message', async (_e, method, params) => {
        if (method !== 'Page.fileChooserOpened') return;
        const file = fileQueue.shift();
        if (file) await dbg.sendCommand('DOM.setFileInputFiles', { files: [file], backendNodeId: params.backendNodeId });
    });
}

/** Saisie dans un champ contrôlé par React. */
const typeInto = (selector, value) => js(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
})()`);

/** Données de la classe enregistrées (dans le navigateur). */
const readClassData = () => js(`new Promise(resolve => {
    const r = indexedDB.open('envolees');
    r.onsuccess = () => { const q = r.result.transaction('classes').objectStore('classes').getAll(); q.onsuccess = () => resolve(JSON.parse(q.result[0].dataJson)); };
})`);

const resize = async (width, height) => {
    win.setContentSize(width, height);
    await wait(500);
};

const waitDownload = async (count, label) => {
    const start = Date.now();
    while (downloads.length < count && Date.now() - start < 60_000) await wait(100);
    const d = downloads[count - 1];
    if (!d || d.state !== 'completed') throw new Error(`téléchargement non terminé : ${label}`);
    return d.path;
};

async function readEnvolees(file) {
    const { readArchive } = await import('../../core/shared/envoleesArchive.js');
    const zlib = await import('node:zlib');
    const { promisify } = await import('node:util');
    return readArchive(new Uint8Array(fs.readFileSync(file)), promisify(zlib.inflateRaw));
}

const imageVisible = () => js(`[...document.images].some(i => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0)`);
const noProgress = () => waitFor("fin du message d'attente", `!document.querySelector('#platform-root [aria-busy]')`, 15_000).then(() => true, () => false);

/** Cibles tactiles trop petites (< 40 px de côté) parmi les commandes visibles. */
const smallTargets = () => js(`[...document.querySelectorAll('button, [role=button], [role=radio], a[href], input, select')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })
    .filter(e => { const r = e.getBoundingClientRect(); return r.height < 40 || r.width < 40; })
    .map(e => (e.getAttribute('aria-label') || e.innerText || e.type || e.tagName).trim().slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height))`);

// ---------------------------------------------------------------------------------------------

async function ordinateur() {
    await setup(1366, 860);
    await win.loadURL(URL_BASE);
    await waitFor('accueil', `[...document.querySelectorAll('button')].some(b => b.innerText.includes('Ouvrir un fichier .envolees') && !b.disabled)`);
    check('accueil : classes de l\'appareil, Nuage, fichier, nouvelle classe', /Ouvrir depuis Nuage/.test(await text()) && /Nouvelle classe/.test(await text()));
    await shot('1-accueil');

    // Ouverture d'un fichier
    fileQueue.push(FIXTURE);
    let t = Date.now();
    await click('Ouvrir un fichier .envolees');
    await waitFor('classe ouverte', `document.body.innerText.includes(${JSON.stringify(EXPECT)}) && !!document.querySelector('nav')`, 120_000);
    check('fichier .envolees ouvert', true, `${Date.now() - t} ms`);
    check("message d'attente refermé", await noProgress());
    check('grand écran : liste des élèves et zone de fiche côte à côte', /Choisissez un élève/.test(await text()));
    if (REAL_IMAGES) {
        await waitFor('photos', `[...document.images].some(i => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0)`, 20_000).catch(() => null);
        check('photos des élèves affichées', await imageVisible());
    }
    await shot('2-eleves');

    // Fiche, validation d'un clic, Ctrl+Z
    await click(EXPECT, 'ul button');
    await waitFor('fiche', `document.querySelectorAll('section > button[aria-expanded]').length > 0`);
    check('fiche affichée à côté de la liste', /À valider/.test(await text()) && await js(`!!document.querySelector('input[placeholder="Rechercher un élève"]')`));
    await js(`document.querySelector('section > button[aria-expanded]').click()`);
    await waitFor('compétences', `!!document.querySelector('button[aria-label^="Valider "]')`);
    let db = await readDb();
    const before = db.classes[0].acquired;
    await js(`document.querySelector('button[aria-label^="Valider "]').click()`);
    await waitFor('message de validation', `document.body.innerText.includes('validée pour')`);
    await wait(1500);
    db = await readDb();
    check('validation d\'un clic enregistrée aussitôt', db.classes[0].acquired === before + 1, `${before} → ${db.classes[0].acquired}`);
    await shot('3-fiche');
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Z', modifiers: ['control'] });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Z', modifiers: ['control'] });
    await wait(1500);
    db = await readDb();
    check('Ctrl+Z annule la validation', db.classes[0].acquired === before);

    // Validation groupée
    await click('Valider', 'nav button');
    await click('Choisir les compétences');
    await waitFor('liste des compétences', `document.querySelectorAll('[role=dialog] input[type=checkbox]').length > 0`);
    await js(`document.querySelectorAll('[role=dialog] input[type=checkbox]')[3].click()`);
    await click('Terminé');
    await click('Tous');
    await shot('4-validation-groupee');
    await js(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('Valider pour')).click()`);
    await waitFor('validation groupée', `document.body.innerText.includes('enregistrée')`);
    await wait(1500);
    check('validation groupée enregistrée', (await readDb()).classes[0].acquired > before);

    await click('Ateliers', 'nav button');
    await waitFor('ateliers', `document.body.innerText.includes('Journal')`);
    await shot('5-ateliers');

    // Nuage (assisté) : téléchargement + onglet Nuage
    await click('Classe', 'nav button');
    await waitFor('onglet Classe', `document.body.innerText.includes('Envoyer vers Nuage')`);
    await shot('6-classe');
    t = Date.now();
    await click('Envoyer vers Nuage');
    await waitFor('fenêtre Nuage', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Télécharger et ouvrir Nuage')`);
    await shot('7-nuage-envoi');
    await click('Télécharger et ouvrir Nuage', '#platform-root button');
    const exported = await waitDownload(1, 'envoi Nuage');
    const back = await readEnvolees(exported);
    const original = await readEnvolees(FIXTURE);
    check('envoi vers Nuage : fichier téléchargé, lisible par l\'application de bureau, images identiques', back.images.size === original.images.size, `${(fs.statSync(exported).size / 1e6).toFixed(0)} Mo, ${Date.now() - t} ms`);
    check('envoi vers Nuage : dossier Envolées de Nuage ouvert dans un onglet', openedTabs.some(u => u.startsWith('https://nuage.apps.education.fr/apps/files/?dir=/Envol%C3%A9es')), openedTabs.join(' '));

    // Ouvrir depuis Nuage (assisté) : retour à l'accueil, choix du fichier téléchargé
    await click('Changer de classe');
    await waitFor('accueil', `document.body.innerText.includes('Mes classes sur cet appareil')`);
    await click('Ouvrir depuis Nuage');
    await waitFor('fenêtre Ouvrir depuis Nuage', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Choisir le fichier')`);
    fileQueue.push(exported);
    await click('Choisir le fichier', '#platform-root button');
    await waitFor('classe déjà présente', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Classe déjà présente')`);
    await click('Remplacer', '#platform-root button');
    await waitFor('classe rouverte', `document.body.innerText.includes(${JSON.stringify(EXPECT)}) && !!document.querySelector('nav')`, 60_000);
    check('ouvrir depuis Nuage : fichier choisi, classe remplacée et ouverte', (await readDb()).classes.length === 1);

    // Persistance et hors ligne
    await win.webContents.reload();
    await waitFor('accueil après rechargement', `!!document.querySelector('[data-class-id]')`);
    const sw = await waitFor('service worker', `navigator.serviceWorker.ready.then(r => !!r.active && caches.keys()).then(k => k && k.length)`, 30_000).catch(() => 0);
    check('service worker actif', sw > 0);
    win.webContents.session.enableNetworkEmulation({ offline: true });
    await win.webContents.reload();
    const offline = await waitFor('accueil hors ligne', `!!document.querySelector('[data-class-id]:not(:disabled)')`, 20_000).then(() => true, () => false);
    if (!offline) console.log('HORS LIGNE :', win.webContents.getURL(), (await text().catch(e => e.message)).slice(0, 300));
    if (offline) await js(`document.querySelector('[data-class-id]').click()`);
    check('hors ligne : application et classe utilisables', offline && await waitFor('classe hors ligne', `document.body.innerText.includes(${JSON.stringify(EXPECT)})`, 60_000).then(() => true, () => false));
    win.webContents.session.disableNetworkEmulation();
}

async function tablette() {
    await setup(820, 1180, { touch: true }); // iPad Air, portrait
    await win.loadURL(URL_BASE);
    await waitFor('accueil', `[...document.querySelectorAll('button')].some(b => b.innerText.includes('Ouvrir depuis Nuage') && !b.disabled)`);
    check('écran tactile détecté (pointer: coarse)', await js(`matchMedia('(pointer: coarse)').matches`));
    await shot('1-accueil-portrait');

    // Ouvrir depuis Nuage, parcours tablette : consigne, puis sélecteur du système
    await tap('Ouvrir depuis Nuage');
    await waitFor('consigne tablette', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Nextcloud')`);
    await shot('2-ouvrir-depuis-nuage');
    fileQueue.push(FIXTURE);
    await tap('Choisir la classe', '#platform-root button');
    await waitFor('classe ouverte', `document.body.innerText.includes(${JSON.stringify(EXPECT)}) && !!document.querySelector('nav')`, 120_000);
    check('ouverture depuis Nuage au toucher (sélecteur du système)', true);
    check("message d'attente refermé", await noProgress());
    check('portrait : liste seule (pas de fiche à côté)', !/Choisissez un élève/.test(await text()));
    check('pas de défilement horizontal (portrait)', await js('document.documentElement.scrollWidth <= window.innerWidth'));
    await shot('3-eleves-portrait');
    const smallList = await smallTargets();
    check('cibles tactiles ≥ 40 px (liste des élèves)', smallList.length === 0, smallList.slice(0, 6).join(' | '));

    // Fiche au toucher
    await tap(EXPECT, 'ul button');
    await waitFor('fiche', `document.querySelectorAll('section > button[aria-expanded]').length > 0`);
    check('fiche en plein écran avec bouton Retour', await js(`!!document.querySelector('button[aria-label="Retour"]')`));
    await js(`document.querySelector('section > button[aria-expanded]').scrollIntoView()`);
    await js(`(() => { const b = document.querySelector('section > button[aria-expanded]'); b.setAttribute('data-e2e', 'domaine'); })()`);
    await tap('', '[data-e2e=domaine]');
    await waitFor('compétences', `!!document.querySelector('button[aria-label^="Valider "]')`);
    const before = (await readDb()).classes[0].acquired;
    await js(`document.querySelector('button[aria-label^="Valider "]').setAttribute('data-e2e', 'valider')`);
    await tap('', '[data-e2e=valider]');
    await waitFor('message de validation', `document.body.innerText.includes('validée pour')`);
    await wait(1500);
    check('validation au toucher enregistrée', (await readDb()).classes[0].acquired === before + 1);
    await shot('4-fiche-portrait');
    const smallDetail = await smallTargets();
    check('cibles tactiles ≥ 40 px (fiche élève)', smallDetail.length === 0, smallDetail.slice(0, 6).join(' | '));
    await tap('Annuler', '[role=status] button');
    await wait(1500);
    check('« Annuler » au toucher', (await readDb()).classes[0].acquired === before);

    // Validation avec photo
    await js(`[...document.querySelectorAll('li button')].find(b => !b.getAttribute('aria-label') && b.closest('section')).setAttribute('data-e2e', 'competence')`);
    await tap('', '[data-e2e=competence]');
    await waitFor('panneau de validation', `document.body.innerText.includes('Photo de preuve')`);
    fileQueue.push(PNG);
    const imagesBefore = (await readDb()).images;
    await tap('Choisir', '[role=dialog] button');
    await waitFor('photo ajoutée', `!!document.querySelector('[role=dialog] img[alt="Photo de preuve"]')`, 15_000);
    await shot('5-validation-photo');
    await js(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.innerText.trim() === 'Valider').setAttribute('data-e2e', 'ok')`);
    await tap('', '[data-e2e=ok]');
    await wait(1500);
    const db = await readDb();
    check('validation avec photo (compressée, rangée)', db.classes[0].acquired === before + 1 && db.images === imagesBefore + 1);

    // Rotation en paysage : liste et fiche côte à côte
    await tap('Retour');
    await resize(1180, 820);
    await waitFor('paysage', `document.body.innerText.includes('Choisissez un élève')`);
    check('paysage : liste et fiche côte à côte', true);
    check('pas de défilement horizontal (paysage)', await js('document.documentElement.scrollWidth <= window.innerWidth'));
    await shot('6-eleves-paysage');

    // Validation groupée au toucher
    await tap('Valider', 'nav button');
    await tap('Choisir les compétences');
    await waitFor('liste des compétences', `document.querySelectorAll('[role=dialog] input[type=checkbox]').length > 0`);
    await js(`document.querySelectorAll('[role=dialog] input[type=checkbox]')[5].setAttribute('data-e2e', 'case')`);
    await tap('', '[data-e2e=case]');
    await tap('Terminé');
    await tap('Tous');
    await shot('7-validation-groupee-paysage');
    const smallMass = await smallTargets();
    check('cibles tactiles ≥ 40 px (validation groupée)', smallMass.length === 0, smallMass.slice(0, 6).join(' | '));
    const beforeMass = (await readDb()).classes[0].acquired;
    await tap('Valider pour');
    await waitFor('validation groupée', `document.body.innerText.includes('enregistrée')`);
    await wait(1500);
    check('validation groupée au toucher', (await readDb()).classes[0].acquired > beforeMass);

    await tap('Ateliers', 'nav button');
    await waitFor('ateliers', `document.body.innerText.includes('Journal')`);
    await shot('8-ateliers-paysage');
    await tap('Classe', 'nav button');
    await waitFor('classe', `document.body.innerText.includes('Envoyer vers Nuage')`);
    await shot('9-classe-paysage');
    const smallClass = await smallTargets();
    check('cibles tactiles ≥ 40 px (onglet Classe)', smallClass.length === 0, smallClass.slice(0, 6).join(' | '));

    // Mode élève : code PIN à définir, l'enfant touche sa photo, montre un QR code d'atelier, sortie par code
    const data = await readClassData();
    await tap('Ateliers', 'nav button');
    await tap('Mode élève');
    await waitFor('mode élève ou code à définir', `!!document.querySelector('[data-mode-eleve]') || document.body.innerText.includes('Code PIN du mode élève')`);
    const pinSetup = await js(`document.body.innerText.includes('Code PIN du mode élève')`);
    if (pinSetup) {
        await typeInto('[role=dialog] input[type=password]', '2580');
        await js(`document.querySelectorAll('[role=dialog] input[type=password]')[1].setAttribute('data-e2e', 'confirmation')`);
        await typeInto('[data-e2e=confirmation]', '2580');
        await tap('Enregistrer', '[role=dialog] button');
    }
    await waitFor('mode élève', `!!document.querySelector('[data-mode-eleve]') && document.body.innerText.includes('Qui es-tu')`);
    await shot('10-mode-eleve');
    const smallKid = await smallTargets();
    check('mode élève : cibles tactiles ≥ 40 px', smallKid.length === 0, smallKid.slice(0, 6).join(' | '));
    const firstName = EXPECT.split(' ')[0];
    await js(`[...document.querySelectorAll('[data-mode-eleve] li button')].find(b => b.innerText.trim() === ${JSON.stringify(firstName)} || b.innerText.trim() === ${JSON.stringify(firstName + ' ' + EXPECT.split(' ')[1][0] + '.')}).setAttribute('data-e2e', 'enfant')`);
    await tap('', '[data-e2e=enfant]');
    await waitFor('caméra', `document.body.innerText.includes('montre ton QR code')`);
    const cameraOk = await waitFor('image de la caméra', `(() => { const v = document.querySelector('[data-mode-eleve] video'); return v && v.videoWidth > 0; })()`, 10_000).then(() => true, () => false);
    check('mode élève : caméra active', cameraOk);
    await shot('11-mode-eleve-scan');
    const student = data.students.find(st => `${st.firstName} ${st.lastName}` === EXPECT);
    const events = data.workshopEvents.length;
    const workshop = data.workshops.find(w => w.isActive && !w.skillIds.every(id => student.skills[id]?.proficiency === 'Acquis')) ?? data.workshops[0];
    await js(`window.dispatchEvent(new CustomEvent('envolees:qr', { detail: ${JSON.stringify(workshop.id)} }))`);
    await waitFor('résultat du passage', `/C'est parti|Bravo|Déjà fait|Patience/.test(document.body.innerText)`);
    await shot('12-mode-eleve-resultat');
    await wait(1500);
    check('mode élève : passage enregistré', (await readClassData()).workshopEvents.length === events + 1, `atelier « ${workshop.name} »`);
    await waitFor('retour au choix', `document.body.innerText.includes('Qui es-tu')`, 10_000);
    await tap('Quitter le mode élève');
    for (const d of [...(pinSetup ? '2580' : data.teacherConfig.studentModePin)]) await tap(d, '[role=dialog] button');
    await tap('OK', '[role=dialog] button');
    await waitFor('sortie du mode élève', `!document.querySelector('[data-mode-eleve]')`, 5000);
    check('mode élève : sortie avec le code enseignant', true);
}

app.whenReady().then(async () => {
    try {
        await (scenario === 'tablette' ? tablette() : ordinateur());
    } catch (error) {
        check('scénario complet', false, error.message);
        await shot('erreur').catch(() => undefined);
        console.log((await text().catch(() => '')).slice(0, 1500));
    }
    const errors = consoleErrors.filter(m => !/favicon|Download the React DevTools/.test(m));
    check('aucune erreur dans la console', errors.length === 0, errors.slice(0, 3).join(' | '));
    finish();
});
