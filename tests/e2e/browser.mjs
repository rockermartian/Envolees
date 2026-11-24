// Test de bout en bout de la version web dans un vrai Chromium (celui d'Electron), fenêtre masquée.
// La version web EST l'application Envolées (mêmes écrans que sur ordinateur) ; on vérifie qu'elle
// s'utilise à la souris comme au doigt. Lancé par run.mjs avec un scénario :
//   - ordinateur : souris et clavier, grand écran ;
//   - tablette   : toucher réel (évènements tactiles du protocole DevTools), paysage puis portrait,
//                  taille des cibles tactiles et commandes cachées derrière le survol, écran par écran ;
//   - audit      : comme « tablette », mais liste tous les défauts sans échouer (aide au développement).
import electron from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { app, BrowserWindow, session } = electron;
const scenario = process.argv.at(-1);
const URL_BASE = process.env.E2E_URL;
const FIXTURE = process.env.E2E_FILE;
const EXPECT = process.env.E2E_EXPECT;
const SHOTS = process.env.E2E_SHOTS;
const REAL_IMAGES = process.env.E2E_REAL_IMAGES === '1';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `envolees-web-e2e-${scenario}-`));
app.setPath('userData', path.join(tmp, 'userData'));
app.on('window-all-closed', () => undefined);
// Caméra simulée par Chromium (mode élève), autorisée sans demande.
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');

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
        .find(e => (e.innerText || '').trim().toLowerCase().includes(want) || (e.getAttribute('aria-label') || '').toLowerCase().includes(want));
})()`;
const DEFAULT_SELECTOR = 'button, [role=button], a, label';

const click = async (label, selector = DEFAULT_SELECTOR) => {
    const ok = await js(`(() => { const el = ${FIND(label, selector)}; if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`introuvable : « ${label} »`);
};

/** Tape au doigt : vrais évènements tactiles au centre de l'élément. */
const tap = async (label, selector = DEFAULT_SELECTOR) => {
    const rect = await js(`(() => { const el = ${FIND(label, selector)}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!rect) throw new Error(`introuvable (toucher) : « ${label} »`);
    const point = [{ x: Math.round(rect.x), y: Math.round(rect.y) }];
    await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
    await wait(40);
    await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(150);
};
/** Tape sur le premier élément visible désigné par un sélecteur CSS. */
const tapSelector = async selector => {
    const ok = await js(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.getBoundingClientRect().width > 0); el?.setAttribute('data-e2e-tap', '1'); return !!el; })()`);
    if (!ok) throw new Error(`introuvable (toucher) : ${selector}`);
    await tap('', '[data-e2e-tap="1"]');
    await js(`document.querySelector('[data-e2e-tap="1"]')?.removeAttribute('data-e2e-tap')`);
};

const shot = async name => {
    if (!SHOTS) return;
    win.webContents.invalidate();
    await wait(600);
    fs.writeFileSync(path.join(SHOTS, `${scenario}-${name}.png`), (await win.webContents.capturePage()).toPNG());
};

const readDb = () => js(`new Promise((resolve, reject) => {
    const r = indexedDB.open('envolees');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
        const tx = r.result.transaction(['classes', 'images'], 'readonly');
        const classes = tx.objectStore('classes').getAll();
        const images = tx.objectStore('images').getAllKeys();
        tx.oncomplete = () => resolve({
            classes: classes.result.map(c => ({ id: c.id, name: c.name, updatedAt: c.updatedAt, acquired: (c.dataJson.match(/"proficiency":"Acquis"/g) || []).length })),
            images: images.result.length,
        });
    };
})`);

/**
 * Défauts tactiles à l'écran :
 *  - commandes et champs de moins de 40 px de côté (cases à cocher : 24 px) ;
 *  - commandes masquées tant que la souris ne les survole pas (opacité 0 + group-hover).
 */
const touchDefects = () => js(`(() => {
    // Visible à l'écran (un parent à opacité nulle, ex. panneau replié, rend l'élément invisible).
    const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && e.checkVisibility({ opacityProperty: true, visibilityProperty: true }); };
    const label = e => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || e.getAttribute('placeholder') || e.type || e.tagName).trim().replace(/\\s+/g, ' ').slice(0, 28);
    const small = [...document.querySelectorAll('button, [role=button], a[href], input:not([type=hidden]), select, textarea')]
        .filter(visible)
        .filter(e => { const r = e.getBoundingClientRect(); const min = e.type === 'checkbox' || e.type === 'radio' ? 24 : 40; return r.height < min - 0.5 || r.width < min - 0.5; })
        .map(e => label(e) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height));
    const hidden = [...document.querySelectorAll('[class*="group-hover:"]')]
        .filter(e => e.matches('button, [role=button]') || e.querySelector('button, [role=button]'))
        .filter(e => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })
        .filter(e => { const s = getComputedStyle(e); return s.opacity === '0' || s.visibility === 'hidden'; })
        .map(e => label(e));
    return { small: [...new Set(small)], hidden: [...new Set(hidden)] };
})()`);

const auditScreen = async name => {
    const { small, hidden } = await touchDefects();
    if (scenario === 'audit') {
        console.log(`--- ${name} : ${small.length} petites cibles, ${hidden.length} commandes cachées (survol)`);
        small.forEach(s => console.log(`    petite : ${s}`));
        hidden.forEach(s => console.log(`    cachée : ${s}`));
        return;
    }
    check(`${name} : cibles tactiles ≥ 40 px`, small.length === 0, small.slice(0, 8).join(' | '));
    check(`${name} : aucune commande réservée au survol`, hidden.length === 0, hidden.slice(0, 5).join(' | '));
};

const fileQueue = [];
const downloads = [];
const openedTabs = [];
const consoleErrors = [];

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
        await dbg.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }, { name: 'any-pointer', value: 'coarse' }, { name: 'any-hover', value: 'none' }] }).catch(() => undefined);
    }
    // Sélecteur de fichiers « classique » (pilotable) ; impression simulée.
    await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `
        delete window.showOpenFilePicker; delete window.showSaveFilePicker;
        window.__printed = 0;
        window.print = () => { window.__printed++; window.dispatchEvent(new Event('afterprint')); };
    ` });
    dbg.on('message', async (_e, method, params) => {
        if (method !== 'Page.fileChooserOpened') return;
        const file = fileQueue.shift();
        if (file) await dbg.sendCommand('DOM.setFileInputFiles', { files: [file], backendNodeId: params.backendNodeId });
    });
}

/** Saisie dans un champ contrôlé par React. */
const typeInto = (selector, value, index = 0) => js(`(() => {
    const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
})()`);

const resize = async (width, height) => { win.setContentSize(width, height); await wait(600); };

const waitDownload = async (count, label) => {
    const start = Date.now();
    while (downloads.length < count && Date.now() - start < 60_000) await wait(100);
    const d = downloads[count - 1];
    if (!d || d.state !== 'completed') throw new Error(`téléchargement non terminé : ${label}`);
    return d.path;
};

async function readEnvolees(file) {
    const { readArchive } = await import('../../app/shared/envoleesArchive.js');
    const zlib = await import('node:zlib');
    const { promisify } = await import('node:util');
    return readArchive(new Uint8Array(fs.readFileSync(file)), promisify(zlib.inflateRaw));
}

const imageVisible = () => js(`[...document.images].some(i => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0)`);
const noProgress = () => waitFor("fin du message d'attente", `!document.querySelector('#platform-root [aria-busy]')`, 15_000).then(() => true, () => false);

/** Ouvre la classe de test par l'écran d'accueil (« Ouvrir une classe » → fichier). */
async function openFixture(act) {
    await waitFor('écran d\'accueil', `document.body.innerText.includes('Bienvenue sur Envolées')`);
    await act('Ouvrir une classe');
    await waitFor('boîte « Ouvrir »', `!!document.querySelector('#platform-root [role=dialog]')`);
    fileQueue.push(FIXTURE);
    await act('Ouvrir un fichier .envolees', '#platform-root button');
    await waitFor('classe affichée', `document.body.innerText.includes(${JSON.stringify(EXPECT)}) && !document.querySelector('#platform-root [role=dialog]')`, 120_000);
}

const TABS = ['Classe', 'Compétences', 'Ateliers', 'Rapports', 'Livret'];

// ---------------------------------------------------------------------------------------------

async function ordinateur() {
    await setup(1366, 860);
    await win.loadURL(URL_BASE);
    await waitFor('écran d\'accueil', `document.body.innerText.includes('Bienvenue sur Envolées')`);
    check('écran d\'accueil de l\'application (avec « Ouvrir depuis Nuage »)', /Ouvrir depuis Nuage/.test(await text()));
    check('boutons de fenêtre Electron masqués', await js(`[...document.querySelectorAll('svg rect[width="10"][height="1"]')].every(r => r.getBoundingClientRect().width === 0)`));
    await shot('1-accueil');

    const t = Date.now();
    await openFixture(click);
    const original = await readEnvolees(FIXTURE);
    check('fichier .envolees ouvert', true, `${(fs.statSync(FIXTURE).size / 1e6).toFixed(0)} Mo, ${original.images.size} images, ${Date.now() - t} ms`);
    check("message d'attente refermé", await noProgress());
    if (REAL_IMAGES) {
        await waitFor('photos', `[...document.images].some(i => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0)`, 20_000).catch(() => null);
        check('photos affichées', await imageVisible());
    }
    check('tous les onglets de l\'application', await js(`${JSON.stringify([...TABS, 'Mode Élève'])}.every(t => [...document.querySelectorAll('header button')].some(b => b.innerText.trim() === t))`));
    await shot('2-classe');

    // Modification + enregistrement (indicateur)
    let db = await readDb();
    const before = db.classes[0].updatedAt;
    await click('Changer le thème');
    await waitFor('modification signalée', `!!document.querySelector('button[aria-label^="Modifications non enregistrées"]')`);
    await click('Modifications non enregistrées');
    await waitFor('enregistré', `!!document.querySelector('button[aria-label="Tout est enregistré"]')`, 60_000);
    db = await readDb();
    check('enregistrement dans le navigateur', db.classes[0].updatedAt > before);

    // Menu › Envoyer vers Nuage (assisté : téléchargement + onglet Nuage)
    await click('Menu');
    await click('Envoyer vers Nuage');
    await waitFor('fenêtre Nuage', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Télécharger et ouvrir Nuage')`);
    await shot('3-nuage');
    await click('Télécharger et ouvrir Nuage', '#platform-root button');
    const exported = await waitDownload(1, 'envoi Nuage');
    const back = await readEnvolees(exported);
    check("Envoyer vers Nuage : fichier identique (lu par l'application de bureau) et onglet Nuage ouvert",
        back.images.size === original.images.size && openedTabs.some(u => u.startsWith('https://nuage.apps.education.fr/apps/files/?dir=/Envol%C3%A9es')));

    // Livret : impression du navigateur
    const printing = js(`window.electronAPI.generateLivretPdf()`);
    await waitFor('message PDF', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Enregistrer au format PDF')`);
    await click('OK', '#platform-root button');
    check('Livret PDF : impression du navigateur', (await printing).success && (await js('window.__printed')) === 1);

    // Menu › Ouvrir depuis Nuage (assisté : choix du fichier téléchargé)
    await click('Menu');
    await click('Ouvrir depuis Nuage');
    await waitFor('fenêtre Ouvrir depuis Nuage', `document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Choisir le fichier')`);
    fileQueue.push(exported);
    await click('Choisir le fichier', '#platform-root button');
    await waitFor('remplacer', `!!document.querySelector('#platform-root [role=dialog]')?.innerText.includes('Classe déjà présente')`, 30_000).catch(() => null);
    if (await js(`!!document.querySelector('#platform-root [role=dialog]')`)) await click('Remplacer', '#platform-root button');
    check('Ouvrir depuis Nuage : classe ouverte', await waitFor('classe rouverte', `document.body.innerText.includes(${JSON.stringify(EXPECT)}) && !document.querySelector('#platform-root [role=dialog]')`, 60_000).then(() => true, () => false));

    // Rechargement et hors ligne
    await win.webContents.reload();
    await waitFor('reprise', `document.body.innerText.includes('Reprendre la dernière session')`);
    const sw = await waitFor('service worker', `navigator.serviceWorker.ready.then(r => !!r.active && caches.keys()).then(k => k && k.length)`, 30_000).catch(() => 0);
    check('service worker actif', sw > 0);
    win.webContents.session.enableNetworkEmulation({ offline: true });
    await win.webContents.reload();
    const offline = await waitFor('accueil hors ligne', `document.body.innerText.includes('Reprendre la dernière session')`, 20_000).then(() => true, () => false);
    if (offline) await click('Reprendre la dernière session');
    check('hors ligne : application et classe utilisables', offline && await waitFor('classe hors ligne', `document.body.innerText.includes(${JSON.stringify(EXPECT)})`, 60_000).then(() => true, () => false));
    win.webContents.session.disableNetworkEmulation();
}

async function tablette() {
    await setup(1180, 820, { touch: process.env.E2E_TOUCH !== '0' }); // iPad Air, paysage (E2E_TOUCH=0 : souris, pour comparer)
    await win.loadURL(URL_BASE);
    await waitFor('écran d\'accueil', `document.body.innerText.includes('Bienvenue sur Envolées')`);
    check('écran tactile détecté (pointer: coarse)', await js(`matchMedia('(pointer: coarse)').matches`));
    await auditScreen('Accueil');
    await openFixture(tap);
    check('classe ouverte au toucher', true);
    check("message d'attente refermé", await noProgress());
    check('pas de défilement horizontal (paysage)', await js('document.documentElement.scrollWidth <= window.innerWidth'));

    // Classe : liste + fiche d'un élève
    await tapSelector('main [role="button"], aside [role="button"]');
    await wait(1000);
    await shot('1-classe');
    await auditScreen('Classe (liste et fiche élève)');

    // Valider une compétence au doigt : pastille « Non acquis » → fenêtre → Enregistrer → indicateur
    if (scenario !== 'audit') {
        const before = (await readDb()).classes[0].acquired;
        await tapSelector('main button.rounded-full.w-32');
        await waitFor('fenêtre de validation', `document.body.innerText.includes('Valider la compétence') || document.body.innerText.includes('Dévalider')`);
        const validating = await js(`document.body.innerText.includes('Valider la compétence')`);
        await tap(validating ? 'Enregistrer' : 'Confirmer', '[role=dialog] button, .fixed button');
        await waitFor('modification signalée', `!!document.querySelector('button[aria-label^="Modifications non enregistrées"]')`);
        await tapSelector('button[aria-label^="Modifications non enregistrées"]');
        await waitFor('enregistré', `!!document.querySelector('button[aria-label="Tout est enregistré"]')`, 60_000);
        const after = (await readDb()).classes[0].acquired;
        check("validation d'une compétence au toucher, enregistrée", after === before + (validating ? 1 : -1), `${before} → ${after}`);
    }

    for (const tab of TABS.slice(1)) {
        await tap(tab, 'header button');
        await wait(1500);
        await shot(`2-${tab}`);
        await auditScreen(tab);
    }

    // Mode élève au doigt : code PIN à définir (ou déjà défini), entrée, caméra, sortie par le code
    if (scenario !== 'audit') {
        await tap('Mode Élève', 'header button');
        await waitFor('code PIN ou confirmation', `document.body.innerText.includes('Code PIN du mode élève') || document.body.innerText.includes('Entrer en Mode Élève')`);
        if (await js(`document.body.innerText.includes('Code PIN du mode élève')`)) {
            await typeInto('[aria-labelledby="pin-setup-title"] input', '2580', 0);
            await typeInto('[aria-labelledby="pin-setup-title"] input', '2580', 1);
            await tap('Enregistrer et entrer');
        } else {
            await tap('Entrer', 'button');
        }
        await waitFor('mode élève', `!!document.querySelector('.fixed.inset-0.z-50') && !document.querySelector('[aria-labelledby="pin-setup-title"]')`);
        await shot('2b-mode-eleve');
        await auditScreen('Mode élève');
        await js(`document.querySelector('.fixed.inset-0.z-50 button')`).then(() => tapSelector('.fixed.inset-0.z-50 button'));
        await waitFor('code de sortie', `!!document.querySelector('input[aria-label="Code PIN"]')`);
        await typeInto('input[aria-label="Code PIN"]', '2580');
        check('mode élève : entrée et sortie au toucher (code PIN)', await waitFor('sortie', `!document.querySelector('.fixed.inset-0.z-50')`, 5000).then(() => true, () => false));
    }

    await tap('Menu', 'header button');
    await wait(300);
    await auditScreen('Menu');
    await tap('Paramètres');
    await wait(800);
    await shot('3-parametres');
    await auditScreen('Paramètres');

    // Portrait
    await tap('Classe', 'header button');
    await resize(820, 1180);
    await shot('4-classe-portrait');
    check('pas de défilement horizontal (portrait)', await js('document.documentElement.scrollWidth <= window.innerWidth'));
    check('portrait : tous les onglets visibles sans faire défiler', await js(`${JSON.stringify([...TABS, 'Mode Élève'])}.every(t => { const b = [...document.querySelectorAll('header button')].find(x => x.innerText.trim() === t); const r = b?.getBoundingClientRect(); return r && r.left >= 0 && r.right <= innerWidth; })`));
    await auditScreen('Classe (portrait)');
    for (const tab of TABS.slice(1)) {
        await tap(tab, 'header button');
        await wait(1200);
        await shot(`5-${tab}-portrait`);
        check(`${tab} (portrait) : rien de coupé à droite`, await js(`(() => { const m = document.querySelector('header')?.nextElementSibling ?? document.body; return [...document.querySelectorAll('main, [class*="overflow-y-auto"]')].every(e => e.getBoundingClientRect().right <= innerWidth + 1); })()`));
        await auditScreen(`${tab} (portrait)`);
    }
    await tap('Classe', 'header button');
    if (scenario === 'audit') {
        // Ce qui déborde horizontalement (éléments plus larges que leur zone défilante)
        const overflow = await js(`(() => {
            const out = [];
            for (const el of document.querySelectorAll('main, main *, aside, aside *')) {
                const s = getComputedStyle(el);
                if (!/(auto|scroll)/.test(s.overflowX) || el.scrollWidth <= el.clientWidth + 1) continue;
                const box = el.getBoundingClientRect();
                const wide = [...el.querySelectorAll('*')].filter(c => c.getBoundingClientRect().right > box.right + 1 && c.children.length < 8)
                    .slice(0, 6).map(c => c.tagName + '.' + String(c.className).split(' ').slice(0, 6).join('.') + ' ' + Math.round(c.getBoundingClientRect().width));
                out.push(el.tagName + '.' + String(el.className).split(' ').slice(0, 5).join('.') + ' ' + el.clientWidth + '/' + el.scrollWidth + ' :: ' + wide.join(' | '));
            }
            return out;
        })()`);
        overflow.forEach(o => console.log('    déborde : ' + o));
    }
}

app.whenReady().then(async () => {
    try {
        if (scenario === 'ordinateur') await ordinateur();
        else await tablette();
    } catch (error) {
        check('scénario complet', false, error.message);
        await shot('erreur').catch(() => undefined);
        console.log((await text().catch(() => '')).slice(0, 1200));
    }
    const errors = consoleErrors.filter(m => !/favicon|Download the React DevTools/.test(m));
    check('aucune erreur dans la console', errors.length === 0, errors.slice(0, 3).join(' | '));
    finish();
});
