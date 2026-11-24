// Service worker d'Envolées (version web) : l'application fonctionne entièrement hors ligne.
//
// - À l'installation : tous les fichiers de l'application sont mis en cache (liste calculée au build
//   par vite.config.ts, qui remplace les deux marqueurs ci-dessous).
// - Ensuite : fichiers servis depuis le cache ; toute navigation reçoit la page de l'application.
// - Nouvelle version : elle attend que l'utilisateur accepte de recharger (message « skip-waiting »),
//   pour ne jamais changer l'application sous ses yeux pendant une saisie.
//
// Les données des classes ne passent jamais par ici : elles sont dans IndexedDB.

const VERSION = __ENVOLEES_VERSION__;
const PRECACHE = __ENVOLEES_PRECACHE__;
const CACHE = `envolees-${VERSION}`;

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })))),
    );
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) {
            if (key.startsWith('envolees-') && key !== CACHE) await caches.delete(key);
        }
        await self.clients.claim();
    })());
});

self.addEventListener('message', event => {
    if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        if (request.mode === 'navigate') {
            // Page de l'application (paramètres d'URL compris : ?ui=mobile…), sauf le guide.
            const shell = url.pathname.endsWith('/guide/index.html') ? await cache.match(url.pathname, { ignoreSearch: true }) : await cache.match('./');
            if (shell) return shell;
            return fetch(request);
        }
        const cached = await cache.match(request, { ignoreSearch: true });
        return cached ?? fetch(request);
    })());
});
