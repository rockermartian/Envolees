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

/** Infobulle affichée (composant Tooltip : boîte fixe ajoutée à <body>). */
const tooltipShown = () => js(`[...document.body.children].some(e => e.style && e.style.position === 'fixed' && e.style.zIndex === '99999')`);
/** Survol à la souris (vrais évènements) du centre d'un élément, ou d'un point. */
const hover = async (label, selector = DEFAULT_SELECTOR) => {
    const at = typeof label === 'object' ? label : await js(`(() => { const el = ${FIND(label, selector)}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    if (!at) throw new Error(`introuvable (survol) : « ${label} »`);
    await dbg.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
    await wait(200);
};

const shot = async name => {
    if (!SHOTS) return;
    win.webContents.invalidate();
    await wait(600);
    await win.webContents.capturePage(); // fenêtre masquée : la 1re capture rend encore l'écran précédent
    await wait(300);
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
            classes: classes.result.map(c => ({
                id: c.id, name: c.name, updatedAt: c.updatedAt, acquired: (c.dataJson.match(/"proficiency":"Acquis"/g) || []).length,
                // Suivi individuel : notes (type connu) et besoins particuliers
                notes: (c.dataJson.match(/"kind":"(observation|parents|equipe|aide|exterieur|todo)"/g) || []).length,
                needs: (c.dataJson.match(/"needs":.{2,80}?]/g) || []).join(' '),
            })),
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
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, ${JSON.stringify(value)}); // champ ou zone de texte
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
    try {
        await waitFor('classe affichée', `document.body.innerText.includes(${JSON.stringify(EXPECT)}) && !document.querySelector('#platform-root [role=dialog]')`, 120_000);
    } catch (error) {
        // Où l'ouverture s'est-elle arrêtée ? Étapes terminées et texte affiché.
        const phases = await js(`performance.getEntriesByType('measure').filter(m => m.name.startsWith('envolees:')).map(m => m.name.slice(9) + ' ' + Math.round(m.duration) + ' ms').join(', ')`).catch(() => '?');
        const screen = await text().catch(() => '?');
        throw new Error(`${error.message} — étapes terminées : ${phases || 'aucune'} — écran : ${screen.replace(/\s+/g, ' ').slice(0, 300)}`);
    }
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
    const phases = await js(`performance.getEntriesByType('measure').filter(m => m.name.startsWith('envolees:')).map(m => m.name.slice(9) + ' ' + Math.round(m.duration) + ' ms').join(', ')`);
    check('ouverture : détail des étapes', true, phases);
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
    await hover('Changer le thème');
    const shownOnHover = await tooltipShown();
    await hover({ x: 600, y: 500 });
    check('infobulle au survol de la souris, refermée en partant', shownOnHover && !(await tooltipShown()));
    await click('Changer le thème');
    await waitFor('modification signalée', `!!document.querySelector('button[aria-label^="Modifications non enregistrées"]')`);
    await click('Modifications non enregistrées');
    await waitFor('enregistré', `!!document.querySelector('button[aria-label="Tout est enregistré"]')`, 60_000);
    db = await readDb();
    check('enregistrement dans le navigateur', db.classes[0].updatedAt > before);

    // Suivi individuel : besoin particulier + note « À faire », visibles dans la liste et enregistrés
    await click(EXPECT, 'aside [role=button]');
    await click('Suivi', '[role=tab]');
    await waitFor('onglet Suivi', `document.body.innerText.includes('Journal de suivi')`);
    await shot('2b-suivi-vide');
    await click('PAI', '[aria-label="Besoins particuliers"] button');
    await click('À faire', '[aria-label="Type de note"] button');
    await typeInto('#note-new-text', 'Appeler la PMI pour le bilan de 4 ans');
    await click('Ajouter la note');
    await waitFor('note ajoutée', `[...document.querySelectorAll('main li')].some(li => li.innerText.includes('Appeler la PMI'))`);
    const listed = await js(`[...document.querySelectorAll('aside [role=button]')].find(e => e.innerText.includes(${JSON.stringify(EXPECT)}))?.innerText ?? ''`);
    await shot('2c-suivi-note');
    await click('Modifications non enregistrées');
    await waitFor('enregistré', `!!document.querySelector('button[aria-label="Tout est enregistré"]')`, 60_000);
    db = await readDb();
    check('suivi : besoin et note « À faire » enregistrés, rappelés dans la liste des élèves',
        db.classes[0].notes >= 1 && /"pai"/.test(db.classes[0].needs) && /PAI/.test(listed) && /1 à faire/.test(listed), `${db.classes[0].notes} note(s), liste : ${listed.replace(/\s+/g, ' ')}`);
    // Impression du suivi : rendu « print » de la page, seule la fiche de suivi doit apparaître
    await js(`window.__savedPrint = window.print; window.print = () => {}; true`);
    await click('Imprimer', 'main button');
    await dbg.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    const printed = await js(`(() => {
        const shown = [...document.body.children].filter(e => getComputedStyle(e).display !== 'none');
        return { ids: shown.map(e => e.id || e.tagName).join(','), text: document.getElementById('followup-print-area')?.innerText ?? '' };
    })()`);
    await dbg.sendCommand('Emulation.setEmulatedMedia', { media: '' });
    await js(`window.print = window.__savedPrint; window.dispatchEvent(new Event('afterprint')); true`);
    check('suivi : impression de la seule fiche (nom, besoins, notes)',
        printed.ids === 'followup-print-area' && printed.text.includes(`Suivi de ${EXPECT}`) && /PAI/.test(printed.text) && /Appeler la PMI/.test(printed.text),
        `${printed.ids} — ${printed.text.replace(/\s+/g, ' ').slice(0, 160)}`);
    await click('Compétences', '[role=tab]');

    // Photos de preuve : fenêtre d'impression, aperçu, options, rendu « print »
    await click('Imprimer les preuves', 'main button');
    await waitFor('fenêtre des preuves', `document.body.innerText.includes('Imprimer les photos de preuve')`);
    const proofs = await js(`(() => {
        const dialog = document.querySelector('[aria-labelledby="print-proofs-title"]');
        const checked = [...dialog.querySelectorAll('[aria-label="Élèves à imprimer"] input:checked')].map(i => i.closest('label').innerText.trim());
        const preview = [...dialog.querySelectorAll('[aria-label="Aperçu"] img')];
        return { checked, count: Number((dialog.innerText.match(/([0-9]+) photos?/) || [])[1] || 0), preview: preview.length, previewLoaded: preview.filter(i => i.complete && i.naturalWidth > 0).length };
    })()`);
    await waitFor('aperçu chargé', `[...document.querySelectorAll('[aria-label="Aperçu"] img')].every(i => i.complete && i.naturalWidth > 0)`, 10_000).catch(() => undefined);
    const previewLoaded = await js(`[...document.querySelectorAll('[aria-label="Aperçu"] img')].filter(i => i.complete && i.naturalWidth > 0).length`);
    check('preuves : aperçu (1re page) avec ses photos affichées', proofs.preview > 0 && proofs.preview < proofs.count && (!REAL_IMAGES || previewLoaded === proofs.preview), `${previewLoaded}/${proofs.preview} photos dans l'aperçu`);
    await shot('2d-preuves');
    await click('Date de validation', '[aria-labelledby="print-proofs-title"] label');
    await js(`window.__savedPrint = window.print; window.print = () => {}; true`);
    await click('Imprimer', '[aria-labelledby="print-proofs-title"] button');
    await waitFor("zone d'impression prête", `[...document.querySelectorAll('style')].some(s => s.textContent.includes('#proofs-print-area'))`, 30_000);
    await dbg.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    const proofPrint = await js(`(() => {
        const area = document.getElementById('proofs-print-area');
        const imgs = [...area.querySelectorAll('img')];
        return {
            shown: [...document.body.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id || e.tagName).join(','),
            imgs: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
            dates: (area.innerText.match(/[0-9]{2}.[0-9]{2}.[0-9]{4}/g) || []).length,
            text: area.innerText.slice(0, 200),
        };
    })()`);
    await dbg.sendCommand('Emulation.setEmulatedMedia', { media: '' });
    await js(`window.print = window.__savedPrint; window.dispatchEvent(new Event('afterprint')); true`);
    check('preuves : élève coché, seules ses photos imprimées et chargées, sans date (option décochée)',
        proofs.checked.length === 1 && proofs.checked[0].includes(EXPECT) && proofPrint.shown === 'proofs-print-area'
        && proofPrint.imgs === proofs.count && proofPrint.imgs > 0 && (!REAL_IMAGES || proofPrint.loaded === proofPrint.imgs) && proofPrint.dates === 0
        && proofPrint.text.includes(EXPECT),
        `${proofs.count} photo(s), ${proofPrint.loaded}/${proofPrint.imgs} chargées, ${proofPrint.dates} date(s), visible : ${proofPrint.shown}`);
    await click('Annuler', '[aria-labelledby="print-proofs-title"] button');

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
        if (process.env.E2E_TOUCH !== '0') check("aucune infobulle après un toucher (indicateur d'enregistrement)", !(await tooltipShown()));
        const after = (await readDb()).classes[0].acquired;
        check("validation d'une compétence au toucher, enregistrée", after === before + (validating ? 1 : -1), `${before} → ${after}`);
    }

    // Suivi individuel au doigt : note ajoutée, écran sans défaut tactile
    if (scenario !== 'audit') {
        await tap('Suivi', '[role=tab]');
        await waitFor('onglet Suivi', `document.body.innerText.includes('Journal de suivi')`);
        await tap('Parents', '[aria-label="Type de note"] button');
        await tapSelector('#note-new-text');
        await typeInto('#note-new-text', 'Rendez-vous de rentrée : tout va bien.');
        await tap('Ajouter la note');
        check('suivi : note ajoutée au toucher', await waitFor('note', `[...document.querySelectorAll('main li')].some(li => li.innerText.includes('Rendez-vous de rentrée'))`, 5000).then(() => true, () => false));
    } else {
        await tap('Suivi', '[role=tab]');
        await wait(500);
    }
    await shot('1b-suivi');
    await auditScreen('Suivi élève');
    await tap('Compétences', '[role=tab]');
    await tap('Imprimer les preuves', 'main button');
    await waitFor('fenêtre des preuves', `document.body.innerText.includes('Imprimer les photos de preuve')`);
    await wait(500);
    await shot('1c-preuves');
    await auditScreen('Impression des photos de preuve');
    await tap('Annuler', '[aria-labelledby="print-proofs-title"] button');

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
    await tapSelector('main [role="button"], aside [role="button"]');
    await tap('Suivi', '[role=tab]');
    await wait(500);
    await shot('4b-suivi-portrait');
    check('Suivi (portrait) : rien de coupé à droite', await js(`[...document.querySelectorAll('main, main section, main li')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)`));
    await auditScreen('Suivi (portrait)');
    await tap('Compétences', '[role=tab]');
    for (const tab of TABS.slice(1)) {
        await tap(tab, 'header button');
        await wait(1200);
        await shot(`5-${tab}-portrait`);
        check(`${tab} (portrait) : rien de coupé à droite`, await js(`(() => { const m = document.querySelector('header')?.nextElementSibling ?? document.body; return [...document.querySelectorAll('main, [class*="overflow-y-auto"]')].every(e => e.getBoundingClientRect().right <= innerWidth + 1); })()`));
        await auditScreen(`${tab} (portrait)`);
    }
    await tap('Classe', 'header button');
    if (scenario !== 'audit' && process.env.E2E_TOUCH !== '0') {
        await tap('Changer le thème');
        const afterTap = await tooltipShown();
        await tap('Changer le thème');
        check('aucune infobulle au doigt (bouton du thème touché deux fois)', !afterTap && !(await tooltipShown()));
    }
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
