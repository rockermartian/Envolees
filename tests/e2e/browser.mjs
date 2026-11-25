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
        // Champs d'une page A4 affichée réduite (aperçu du livret sur téléphone) : on zoome pour les modifier.
        .filter(e => { const z = e.closest('.zoom-container'); const m = z && getComputedStyle(z).transform; return !(m && m !== 'none' && new DOMMatrix(m).a < 0.99); })
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
    // E2E_PHONE=1 : écran de téléphone (390 × 844) au lieu de la tablette, pour l'audit
    const PHONE = process.env.E2E_PHONE === '1';
    await setup(PHONE ? 390 : 1180, PHONE ? 844 : 820, { touch: process.env.E2E_TOUCH !== '0' }); // iPad Air, paysage (E2E_TOUCH=0 : souris, pour comparer)
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
    await resize(PHONE ? 390 : 820, PHONE ? 844 : 1180);
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

// ---------------------------------------------------------------------------------------------
// Téléphone : la même application, présentation « téléphone » sous 640 px de large.
// Deux tailles : iPhone (390 × 844) et petit Android (360 × 780). Vrais évènements tactiles.

/** Rien ne fait défiler la page horizontalement (ni la page, ni le conteneur de l'application). */
const pageFits = () => js(`(() => {
    const root = document.querySelector('#root > div') || document.querySelector('#root');
    return document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth && (!root || root.scrollLeft === 0);
})()`);
/** Éléments visibles qui dépassent à droite de l'écran. */
const overflowing = () => js(`[
    // éléments visibles qui sortent de l'écran à droite
    ...[...document.querySelectorAll('body *')]
        .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > innerWidth + 1 && e.checkVisibility({ opacityProperty: true, visibilityProperty: true }); })
        .map(e => e.tagName + '.' + String(e.className).split(' ').slice(0, 3).join('.') + ' → ' + Math.round(e.getBoundingClientRect().right) + 'px'),
    // zones qui défilent sur le côté (contenu, même invisible, plus large qu'elles)
    ...[...document.querySelectorAll('body *')]
        .filter(e => e && e.checkVisibility() && /(auto|scroll)/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 1)
        .map(e => 'défilement horizontal ' + e.tagName + '.' + String(e.className).split(' ').slice(0, 3).join('.') + ' ' + e.clientWidth + '/' + e.scrollWidth),
].slice(0, 4)`);

/** Écrans dont la mise en page téléphone reste à faire (étape du chantier) : relevé, sans échec. */
const PHONE_LATER = {};

async function telephone() {
    const sizes = [[390, 844, 'iPhone'], [360, 780, 'Android']];
    const nav = 'nav[aria-label="Navigation principale"]';
    await setup(sizes[0][0], sizes[0][1], { touch: true });
    await win.loadURL(URL_BASE);
    await waitFor("écran d'accueil", `document.body.innerText.includes('Bienvenue sur Envolées')`);
    check('accueil sans débordement', await pageFits());
    await openFixture(tap);
    check("message d'attente refermé", await noProgress());

    for (const [w, h, device] of sizes) {
        await resize(w, h);
        check(`${device} (${w} px) : barre d'onglets en bas, onglets de l'en-tête masqués`, await js(`(() => {
            const nav = document.querySelector('${nav}');
            const r = nav?.getBoundingClientRect();
            const headerTabs = [...document.querySelectorAll('header button')].filter(b => b.innerText.trim() === 'Ateliers' && b.checkVisibility());
            return !!r && r.width > 0 && Math.abs(r.bottom - innerHeight) < 2 && nav.querySelectorAll('button').length === 5 && headerTabs.length === 0
                && [...nav.querySelectorAll('span')].every(t => t.scrollWidth <= t.clientWidth + 1); // libellés entiers
        })()`));
        check(`${device} : en-tête sur une ligne, rien de coupé`, await js(`(() => {
            const h = document.querySelector('header').getBoundingClientRect();
            return h.height <= 72 && [...document.querySelectorAll('header button')].filter(b => b.checkVisibility()).every(b => b.getBoundingClientRect().right <= innerWidth);
        })()`));

        for (const [tab, label] of [['class', 'Classe'], ['skills', 'Compétences'], ['workshops', 'Ateliers'], ['reports', 'Rapports']]) {
            await tap(label, `${nav} button`);
            await wait(900);
            const ok = await js(`document.querySelector('${nav} [aria-current="page"]')?.innerText.trim() === ${JSON.stringify(label)}`);
            check(`${device} : onglet ${label} ouvert depuis la barre du bas`, ok);
            if (w === 390) { await shot(tab); await auditScreen(`${label} (téléphone)`); }
            const over = await overflowing();
            if (PHONE_LATER[label]) console.log(`    écran ${label} (${w} px) : ${over.length ? 'dépasse : ' + over.join(' | ') : 'rien ne dépasse'} — mise en page : étape ${PHONE_LATER[label]}`);
            else check(`${device} : ${label}, rien ne dépasse de l'écran`, over.length === 0, over.join(' | '));
            check(`${device} : ${label}, la page ne se décale pas`, await pageFits());
            if (label === 'Rapports') {
                await tap('Journal', 'button');
                await wait(800);
                if (w === 390) { await shot('journal'); await auditScreen('Rapports › Journal (téléphone)'); }
                const overJ = await overflowing();
                check(`${device} : Rapports › Journal, rien ne dépasse de l'écran`, overJ.length === 0, overJ.join(' | '));
                await tap('À traiter', 'button');
                await wait(300);
            }
        }

        // Volet « Plus » : Livret, Paramètres, thème, Mode élève
        for (const [label, title] of [['Livret', 'Réglages'], ['Paramètres', 'Paramètres']]) {
            await tap('Plus', `${nav} button`);
            await waitFor('volet Plus', `!!document.querySelector('.bottom-sheet')`);
            if (w === 390 && label === 'Livret') { await shot('plus'); await auditScreen('Volet « Plus »'); }
            await tap(label, '.bottom-sheet button');
            await wait(900);
            check(`${device} : ${label} ouvert depuis « Plus » (volet refermé)`, await js(`!document.querySelector('.bottom-sheet') && document.body.innerText.includes(${JSON.stringify(title)})`));
            if (w === 390) { await shot(label); await auditScreen(`${label} (téléphone)`); }
            const over = await overflowing();
            if (PHONE_LATER[label]) console.log(`    écran ${label} (${w} px) : ${over.length ? 'dépasse : ' + over.join(' | ') : 'rien ne dépasse'} — mise en page : étape ${PHONE_LATER[label]}`);
            else check(`${device} : ${label}, rien ne dépasse de l'écran`, over.length === 0, over.join(' | '));
            check(`${device} : ${label}, la page ne se décale pas`, await pageFits());
        }
        const dark = await js(`document.documentElement.classList.contains('dark')`);
        await tap('Plus', `${nav} button`);
        await waitFor('volet Plus', `!!document.querySelector('.bottom-sheet')`);
        await tap(dark ? 'Thème clair' : 'Thème sombre', '.bottom-sheet button');
        await wait(300);
        check(`${device} : thème changé depuis « Plus »`, (await js(`document.documentElement.classList.contains('dark')`)) !== dark);
        await tap('Plus', `${nav} button`);
        await waitFor('volet Plus', `!!document.querySelector('.bottom-sheet')`);
        await tap('Mode Élève', '.bottom-sheet button');
        check(`${device} : Mode élève proposé depuis « Plus » (code PIN ou confirmation)`,
            await waitFor('mode élève', `document.body.innerText.includes('Code PIN du mode élève') || document.body.innerText.includes('Entrer en Mode Élève')`, 5000).then(() => true, () => false));
        await tap('Annuler', '[role=dialog] button');
        await wait(300);

        // Classe (étape 2) : liste plein écran → synthèse ; liste → fiche → retour
        await tap('Classe', `${nav} button`);
        await wait(600);
        const visible = sel => js(`!!document.querySelector(${JSON.stringify(sel)})?.checkVisibility()`);
        check(`${device} : Classe, la liste des élèves seule à l'écran`, (await visible('aside')) && !(await visible('main')));
        await tap('Synthèse de la classe', 'aside button');
        await wait(600);
        check(`${device} : synthèse de la classe à la place de la liste, rien ne dépasse`, !(await visible('aside')) && (await visible('main')) && (await overflowing()).length === 0, (await overflowing()).join(' | '));
        if (w === 390) { await shot('synthese'); await auditScreen('Synthèse de la classe (téléphone)'); }
        await tap('Retour à la liste des élèves', 'main button');
        await wait(400);
        await tapSelector('aside [role="button"]');
        await wait(800);
        check(`${device} : fiche de l'élève seule à l'écran, rien ne dépasse`, !(await visible('aside')) && (await visible('main')) && (await overflowing()).length === 0 && (await pageFits()), (await overflowing()).join(' | '));
        if (w === 390) {
            await shot('fiche');
            await auditScreen('Fiche élève (téléphone)');
            // Valider une compétence au doigt (fenêtre plein écran), puis enregistrer
            const before = (await readDb()).classes[0].acquired;
            await tapSelector('main button.rounded-full.w-32');
            await waitFor('fenêtre de validation', `document.body.innerText.includes('Valider la compétence') || document.body.innerText.includes('Dévalider')`);
            const validating = await js(`document.body.innerText.includes('Valider la compétence')`);
            await tap(validating ? 'Enregistrer' : 'Confirmer', '[role=dialog] button');
            await waitFor('modification signalée', `!!document.querySelector('button[aria-label^="Modifications non enregistrées"]')`);
            await tapSelector('button[aria-label^="Modifications non enregistrées"]');
            await waitFor('enregistré', `!!document.querySelector('button[aria-label="Tout est enregistré"]')`, 60_000);
            const after = (await readDb()).classes[0].acquired;
            check('téléphone : compétence validée au doigt et enregistrée', after === before + (validating ? 1 : -1), `${before} → ${after}`);
            // Volet « Affichage » : vue Liste, puis retour à l'arborescence
            await tap('Affichage', 'main button');
            await waitFor('volet Affichage', `!!document.querySelector('.bottom-sheet')`);
            await shot('affichage');
            await auditScreen('Volet « Affichage » (téléphone)');
            await tap('Liste', '.bottom-sheet button');
            await tap('Fermer', '.bottom-sheet button');
            await wait(300);
            check('téléphone : vue Liste choisie dans le volet « Affichage »', await js(`[...document.querySelectorAll('main button')].some(b => b.innerText.includes('Affichage') && b.innerText.includes('Liste'))`));
            await tap('Affichage', 'main button');
            await tap('Arborescence', '.bottom-sheet button');
            await tap('Fermer', '.bottom-sheet button');
            await wait(300);
            await tap('Suivi', '[role=tab]');
            await wait(400);
            check('téléphone : onglet Suivi, rien ne dépasse', (await overflowing()).length === 0, (await overflowing()).join(' | '));
            await shot('suivi');
            await auditScreen('Suivi (téléphone)');
            await tap('Compétences', '[role=tab]');
        }
        await tap('Retour à la classe', 'main button');
        await wait(400);
        check(`${device} : retour de la fiche à la liste`, (await visible('aside')) && !(await visible('main')));

        // Compétences (étape 4) : actions « ⋯ » d'un domaine et d'une compétence, au doigt
        if (w === 390) {
            await tap('Compétences', `${nav} button`);
            await wait(800);
            await tap('Actions : ', '[aria-label^="Actions : D"]');
            await waitFor('volet du domaine', `!!document.querySelector('.bottom-sheet')`);
            await shot('competences-actions');
            await auditScreen('Actions d\'un domaine (téléphone)');
            await tap('Ajouter une compétence', '.bottom-sheet button');
            await waitFor('fiche compétence', `!!document.querySelector('#skill-name')`);
            await typeInto('#skill-name', 'Compétence ajoutée au téléphone');
            await tapSelector('[role=dialog] button[type="submit"]');
            const added = await waitFor('compétence ajoutée', `[...document.querySelectorAll('li')].some(li => li.innerText.includes('Compétence ajoutée au téléphone'))`, 5000).then(() => true, () => false);
            await tap('Actions : Compétence ajoutée au téléphone', 'button');
            await waitFor('volet de la compétence', `!!document.querySelector('.bottom-sheet')`);
            const labels = await js(`[...document.querySelectorAll('.bottom-sheet button')].map(b => b.innerText.split('\\n')[0]).join('|')`);
            await tap('Supprimer', '.bottom-sheet button');
            await waitFor('confirmation', `document.body.innerText.includes('Supprimer la compétence')`);
            await tap('Confirmer', '[role=dialog] button');
            const removed = await waitFor('compétence supprimée', `![...document.querySelectorAll('li')].some(li => li.innerText.includes('Compétence ajoutée au téléphone'))`, 5000).then(() => true, () => false);
            check('téléphone : Compétences, ajouter puis supprimer une compétence par le menu « ⋯ »',
                added && removed && /Monter\|Descendre\|Déplacer vers…\|Modifier\|Supprimer/.test(labels), labels);
        }

        // Livret (étape 5) : Élèves → aperçu ajusté à l'écran ; Réglages ; rendu d'impression en A4
        await tap('Plus', `${nav} button`);
        await waitFor('volet Plus', `!!document.querySelector('.bottom-sheet')`);
        await tap('Livret', '.bottom-sheet button');
        await wait(800);
        const livretTab = label => tap(label, '[aria-label="Livret"] [role=tab]');
        await livretTab('Élèves');
        await wait(400);
        check(`${device} : Livret › Élèves, liste en plein écran`, await js(`!!document.querySelector('.livret-view aside [role="button"]')?.checkVisibility()`));
        await tapSelector('.livret-view aside [role="button"]');
        await waitFor('aperçu du livret', `!!document.querySelector('.livret-page')?.checkVisibility() && document.querySelector('[aria-label="Livret"] [aria-selected="true"]')?.innerText.trim() === 'Aperçu'`, 10_000);
        await wait(2500); // pagination
        const page = await js(`(() => { const r = document.querySelector('.livret-page').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; })()`);
        const overL = await overflowing();
        check(`${device} : Livret, élève choisi → aperçu ajusté à la largeur, rien ne dépasse`, page.left >= 0 && page.right <= w && page.width > w * 0.7 && overL.length === 0, `page ${page.left}–${page.right} px ; ${overL.join(' | ')}`);
        if (w === 390) { await shot('livret-apercu'); await auditScreen('Livret › Aperçu (téléphone)'); }
        await livretTab('Réglages');
        await wait(400);
        const overC = await overflowing();
        check(`${device} : Livret › Réglages, rien ne dépasse`, (await js(`document.body.innerText.includes('Configuration du Livret')`)) && overC.length === 0, overC.join(' | '));
        if (w === 390) { await shot('livret-reglages'); await auditScreen('Livret › Réglages (téléphone)'); }
        await livretTab('Aperçu');
        await wait(300);
        if (w === 390) {
            await dbg.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
            // À l'impression, le zoom de l'écran et la boîte réduite sont neutralisés (mise en page = ordinateur).
            const printed = await js(`(() => {
                const page = document.querySelector('.livret-page');
                const box = document.querySelector('.zoom-fit-box');
                const zoom = document.querySelector('.zoom-container');
                return { transform: getComputedStyle(zoom).transform, overflow: getComputedStyle(box).overflow, boxH: box.offsetHeight, pageH: page.offsetHeight };
            })()`);
            await dbg.sendCommand('Emulation.setEmulatedMedia', { media: '' });
            check("téléphone : livret imprimé sans le zoom de l'écran (comme sur ordinateur)", printed.transform === 'none' && printed.overflow === 'visible' && printed.boxH >= printed.pageH - 1, JSON.stringify(printed));
        }

        // Assistants et fenêtres (étape 6) : rien ne dépasse, commandes assez grandes au doigt
        const escape = () => js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
        const dialogCheck = async (name, open) => {
            await open();
            await waitFor(name, `!!document.querySelector('[role=dialog]')`, 5000).catch(() => undefined);
            await wait(700);
            const over = await overflowing();
            check(`${device} : ${name}, rien ne dépasse`, over.length === 0, over.join(' | '));
            if (w === 390) { await shot(`fenetre-${name}`); await auditScreen(`${name} (téléphone)`); }
            await escape();
            await wait(400);
        };
        await tap('Classe', `${nav} button`);
        await wait(500);
        if (await visible('main')) { await tap('Retour à la classe', 'main button'); await wait(400); }
        await dialogCheck('Validation en masse', async () => {
            await tap('Valider en masse', 'aside button');
            await wait(600);
            check(`${device} : validation en masse, contenu visible sous l'en-tête`, await js(`(() => {
                const d = document.querySelector('[role=dialog][aria-label="Validation en masse"]');
                const kids = [...d.children].filter(c => c.checkVisibility());
                return kids.length >= 2 && kids[0].getBoundingClientRect().height < 120 && kids.some(c => c.getBoundingClientRect().top < innerHeight - 100 && c.getBoundingClientRect().height > 100);
            })()`));
        });
        await dialogCheck('Promotion', () => tap('Promouvoir', 'aside button'));
        await dialogCheck('Export des élèves', () => tap('Exporter les élèves', 'aside button'));
        await tapSelector('aside [role="button"]');
        await wait(600);
        await dialogCheck('Impression des preuves', async () => {
            await tap('Affichage', 'main button');
            await waitFor('volet Affichage', `!!document.querySelector('.bottom-sheet')`);
            await tap('Imprimer les preuves', '.bottom-sheet button');
        });
        await tap('Retour à la classe', 'main button');
        await tap('Ateliers', `${nav} button`);
        await wait(600);
        await dialogCheck('Nouvel atelier', () => tap('Nouvel atelier', 'button'));
        await dialogCheck('Impression des QR codes', () => tap('Imprimer les QR codes', 'button'));
        await dialogCheck('Export des ateliers', () => tap('Exporter des ateliers', 'button'));
        // Menu Fichier
        await tap('Menu', 'header button');
        await wait(300);
        const menu = await js(`(() => { const m = [...document.querySelectorAll('header div.absolute')].find(e => e.checkVisibility()); if (!m) return null; const r = m.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right) }; })()`);
        check(`${device} : menu Fichier dans l'écran`, !!menu && menu.left >= 0 && menu.right <= w, JSON.stringify(menu));
        if (w === 390) { await shot('menu-fichier'); await auditScreen('Menu Fichier (téléphone)'); }
        await tap('Menu', 'header button');
        await wait(300);
        // Mode élève : code PIN, écran des élèves, sortie. Le plein écran demandé par le mode élève
        // agrandirait la fenêtre de test (1920 px) : neutralisé pour mesurer à la taille du téléphone.
        if (w === 390) {
            await js(`document.documentElement.requestFullscreen = () => Promise.resolve(); true`);
            await tap('Plus', `${nav} button`);
            await waitFor('volet Plus', `!!document.querySelector('.bottom-sheet')`);
            await tap('Mode Élève', '.bottom-sheet button');
            await waitFor('code PIN ou confirmation', `document.body.innerText.includes('Code PIN du mode élève') || document.body.innerText.includes('Entrer en Mode Élève')`);
            if (await js(`document.body.innerText.includes('Code PIN du mode élève')`)) {
                await auditScreen('Code PIN (téléphone)');
                await typeInto('[aria-labelledby="pin-setup-title"] input', '2580', 0);
                await typeInto('[aria-labelledby="pin-setup-title"] input', '2580', 1);
                await tap('Enregistrer et entrer');
            } else {
                await tap('Entrer', 'button');
            }
            await waitFor('mode élève', `!!document.querySelector('.fixed.inset-0.z-50') && !document.querySelector('[aria-labelledby="pin-setup-title"]')`);
            await wait(800);
            const overS = await js(`[...document.querySelectorAll('.fixed.inset-0.z-50 *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && e.checkVisibility(); }).slice(0, 3).map(e => e.tagName + '.' + String(e.className).split(' ').slice(0, 3).join('.'))`);
            check('téléphone : mode élève, rien ne dépasse', overS.length === 0, overS.join(' | '));
            await shot('mode-eleve');
            await auditScreen('Mode élève (téléphone)');
            await tapSelector('.fixed.inset-0.z-50 button');
            await waitFor('code de sortie', `!!document.querySelector('input[aria-label="Code PIN"]')`);
            await shot('mode-eleve-sortie');
            await auditScreen('Sortie du mode élève (téléphone)');
            await typeInto('input[aria-label="Code PIN"]', '2580');
            check('téléphone : mode élève, entrée et sortie au toucher', await waitFor('sortie', `!document.querySelector('.fixed.inset-0.z-50')`, 5000).then(() => true, () => false));
        }

        // Une fenêtre (« Ajouter un élève ») occupe tout l'écran
        await tap('Classe', `${nav} button`);
        await wait(600);
        if (await visible('main')) { await tap('Retour à la classe', 'main button'); await wait(400); } // élève choisi dans le livret
        await tap('Ajouter un élève', 'aside button');
        await waitFor('fiche élève', `!!document.querySelector('[role=dialog] input')`);
        if (w === 390) await shot('fenetre');
        check(`${device} : fenêtre en plein écran`, await js(`(() => {
            const panel = document.querySelector('[role=dialog][aria-modal=true].fixed > :first-child');
            const r = panel.getBoundingClientRect();
            return r.left <= 0.5 && Math.abs(r.width - innerWidth) < 1 && r.height >= innerHeight - 40;
        })()`));
        await tap('Fermer', '[role=dialog] button');
        await wait(300);
    }
}

app.whenReady().then(async () => {
    try {
        if (scenario === 'ordinateur') await ordinateur();
        else if (scenario === 'telephone') await telephone();
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
