// Client Nuage (Nextcloud de l'Éducation nationale, apps.education.fr) — JavaScript pur, sans dépendance.
//
// Utilisé par le processus principal Electron. Écrit pour fonctionner aussi dans un navigateur, le jour
// où Nuage autorisera les requêtes venant de la version web (en-têtes CORS) : aujourd'hui, un
// navigateur bloque ces requêtes.
//
// Connexion : « Login Flow v2 » de Nextcloud, la méthode du client de synchronisation officiel.
//   1. POST <nuage>/index.php/login/v2 → adresse de connexion + jeton de suivi ;
//   2. l'utilisateur ouvre l'adresse dans son navigateur et se connecte (identifiant Éducation nationale) ;
//   3. l'application interroge le jeton jusqu'à recevoir { server, loginName, appPassword } :
//      un mot de passe d'application propre à cet appareil, révocable (Paramètres › Sécurité de Nuage).
// Fichiers : WebDAV (remote.php/dav), envoi par morceaux au-delà de CHUNK_SIZE.

export const NUAGE_URL = 'https://nuage.apps.education.fr';
export const NUAGE_FOLDER = 'Envolées';
export const CHUNK_SIZE = 10 * 1024 * 1024;

export class NuageError extends Error {
    /** @param {'network'|'auth'|'quota'|'not-found'|'login-timeout'|'cancelled'|'server'} code */
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

const MESSAGES = {
    network: "Nuage est injoignable. Vérifiez la connexion à Internet, puis réessayez.",
    auth: "L'accès à Nuage a expiré ou a été révoqué. Reconnectez-vous à Nuage.",
    quota: "L'espace de stockage Nuage est plein.",
    'not-found': "Ce fichier ou ce dossier n'existe plus dans Nuage.",
};

const errorFor = (status, what) => {
    if (status === 401 || status === 403) return new NuageError('auth', MESSAGES.auth, status);
    if (status === 507) return new NuageError('quota', MESSAGES.quota, status);
    if (status === 404) return new NuageError('not-found', MESSAGES['not-found'], status);
    return new NuageError('server', `Nuage a refusé l'opération (${what} : erreur ${status}).`, status);
};

async function request(fetchImpl, url, init) {
    try {
        return await fetchImpl(url, init);
    } catch (error) {
        if (error?.name === 'AbortError') throw new NuageError('cancelled', 'Opération annulée.');
        throw new NuageError('network', MESSAGES.network);
    }
}

const wait = (ms, signal) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new NuageError('cancelled', 'Connexion annulée.')); }, { once: true });
});

/**
 * Nom de l'application envoyé à Nuage (affiché dans Nuage › Paramètres › Sécurité). Nuage répond
 * « erreur 500 » à un nom accentué : seuls les caractères ASCII sont envoyés (« Envolées » → « Envolees »).
 */
export const asciiUserAgent = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');

const base64 = text => (typeof Buffer !== 'undefined' ? Buffer.from(text, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(text))));

// ---------------------------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------------------------

/**
 * Démarre la connexion. Renvoie l'adresse à ouvrir dans le navigateur et le jeton de suivi.
 * @param {{ baseUrl?: string, userAgent?: string, fetch?: typeof fetch }} [options]
 */
export async function startLogin({ baseUrl = NUAGE_URL, userAgent = 'Envolées', fetch: fetchImpl = fetch } = {}) {
    const response = await request(fetchImpl, `${baseUrl}/index.php/login/v2`, { method: 'POST', headers: { 'User-Agent': asciiUserAgent(userAgent) } });
    if (!response.ok) throw errorFor(response.status, 'connexion');
    const body = await response.json();
    if (!body?.login || !body?.poll?.token || !body?.poll?.endpoint) throw new NuageError('server', "Réponse inattendue de Nuage à la demande de connexion.");
    return { loginUrl: body.login, poll: body.poll };
}

/**
 * Attend que l'utilisateur ait accepté la connexion dans son navigateur.
 * @param {{ token: string, endpoint: string }} poll
 * @param {{ intervalMs?: number, timeoutMs?: number, signal?: AbortSignal, fetch?: typeof fetch }} [options]
 * @returns {Promise<{ server: string, loginName: string, appPassword: string }>}
 */
export async function waitForLogin(poll, { intervalMs = 2000, timeoutMs = 20 * 60 * 1000, signal, fetch: fetchImpl = fetch } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (signal?.aborted) throw new NuageError('cancelled', 'Connexion annulée.');
        const response = await request(fetchImpl, poll.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `token=${encodeURIComponent(poll.token)}`,
            signal,
        });
        if (response.ok) {
            const credentials = await response.json();
            if (credentials?.server && credentials?.loginName && credentials?.appPassword) {
                return { server: credentials.server.replace(/\/+$/, ''), loginName: credentials.loginName, appPassword: credentials.appPassword };
            }
            throw new NuageError('server', 'Réponse inattendue de Nuage après la connexion.');
        }
        if (response.status !== 404) throw errorFor(response.status, 'connexion');
        await wait(intervalMs, signal);
    }
    throw new NuageError('login-timeout', "La connexion n'a pas été validée à temps dans le navigateur. Recommencez.");
}

// ---------------------------------------------------------------------------------------------
// Fichiers
// ---------------------------------------------------------------------------------------------

/** Encode un chemin (segments séparés par « / ») pour une adresse WebDAV. */
const encodePath = path => path.split('/').filter(Boolean).map(encodeURIComponent).join('/');

/** Extrait les entrées d'une réponse PROPFIND (multistatus), quel que soit le préfixe XML. */
export function parseMultistatus(xml) {
    const tag = name => new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'i');
    const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    const responses = xml.split(/<(?:[\w-]+:)?response\b[^>]*>/i).slice(1);
    return responses.map(block => {
        const href = decode(tag('href').exec(block)?.[1]?.trim() ?? '');
        // Seul le propstat « 200 OK » porte les propriétés existantes.
        const okProps = block.split(/<(?:[\w-]+:)?propstat\b[^>]*>/i).slice(1).find(p => /HTTP\/1\.[01] 200/.test(p)) ?? block;
        const length = tag('getcontentlength').exec(okProps)?.[1];
        const modified = tag('getlastmodified').exec(okProps)?.[1];
        return {
            href,
            isFolder: /<(?:[\w-]+:)?collection\b/i.test(tag('resourcetype').exec(okProps)?.[1] ?? ''),
            size: length ? Number(length) : null,
            modified: modified ? new Date(modified).toISOString() : null,
        };
    });
}

export class NuageClient {
    /**
     * @param {{ server: string, loginName: string, appPassword: string, userId?: string }} account
     * @param {{ fetch?: typeof fetch, userAgent?: string }} [options]
     */
    constructor(account, { fetch: fetchImpl = fetch, userAgent = 'Envolées' } = {}) {
        this.server = account.server.replace(/\/+$/, '');
        this.loginName = account.loginName;
        this.userId = account.userId ?? account.loginName;
        this.headers = { Authorization: `Basic ${base64(`${account.loginName}:${account.appPassword}`)}`, 'User-Agent': asciiUserAgent(userAgent) };
        this.fetch = fetchImpl;
    }

    /** Adresse WebDAV d'un chemin relatif aux fichiers de l'utilisateur. */
    fileUrl(path = '') {
        const encoded = encodePath(path);
        return `${this.server}/remote.php/dav/files/${encodeURIComponent(this.userId)}/${encoded}${encoded && path.endsWith('/') ? '/' : ''}`;
    }

    async call(url, init, what) {
        const response = await request(this.fetch, url, { ...init, headers: { ...this.headers, ...init.headers } });
        if (!response.ok && response.status !== 207) throw errorFor(response.status, what);
        return response;
    }

    /** Compte : identifiant interne, nom affiché, espace utilisé. */
    async whoami() {
        const response = await this.call(`${this.server}/ocs/v2.php/cloud/user?format=json`, { headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' } }, 'compte');
        const data = (await response.json())?.ocs?.data;
        if (!data?.id) throw new NuageError('server', 'Réponse inattendue de Nuage (compte).');
        this.userId = data.id;
        return { userId: data.id, displayName: data.displayname || data['display-name'] || data.id, quota: data.quota ?? null };
    }

    /** Contenu d'un dossier (sans le dossier lui-même), dossiers d'abord. */
    async list(folder) {
        const body = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>';
        const response = await this.call(this.fileUrl(`${folder}/`), { method: 'PROPFIND', headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' }, body }, 'liste');
        const root = `/remote.php/dav/files/${encodeURIComponent(this.userId)}/`;
        const self = encodePath(folder);
        return parseMultistatus(await response.text())
            .map(entry => {
                const at = entry.href.indexOf(root);
                const relative = decodeURIComponent((at >= 0 ? entry.href.slice(at + root.length) : entry.href).replace(/\/+$/, ''));
                return { ...entry, path: relative, name: relative.split('/').pop() ?? relative };
            })
            .filter(entry => encodePath(entry.path) !== self)
            .sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name, 'fr'));
    }

    /** Informations sur un fichier, ou null s'il n'existe pas. */
    async stat(path) {
        const response = await request(this.fetch, this.fileUrl(path), { method: 'PROPFIND', headers: { ...this.headers, Depth: '0' } });
        if (response.status === 404) return null;
        if (!response.ok && response.status !== 207) throw errorFor(response.status, 'informations');
        return parseMultistatus(await response.text())[0] ?? null;
    }

    /** Crée un dossier et ses parents s'ils n'existent pas. */
    async ensureFolder(folder) {
        let current = '';
        for (const segment of folder.split('/').filter(Boolean)) {
            current = current ? `${current}/${segment}` : segment;
            const response = await request(this.fetch, this.fileUrl(`${current}/`), { method: 'MKCOL', headers: this.headers });
            // 201 : créé ; 405 : existe déjà.
            if (!response.ok && response.status !== 405) throw errorFor(response.status, 'création du dossier');
        }
    }

    /**
     * Envoie un fichier (remplace la version existante : Nuage garde l'historique des versions).
     * Au-delà de CHUNK_SIZE : envoi par morceaux (reprise d'un morceau en cas de coupure brève).
     * @param {string} path
     * @param {Uint8Array} bytes
     * @param {{ onProgress?: (sent: number, total: number) => void, chunkSize?: number }} [options]
     */
    async upload(path, bytes, { onProgress, chunkSize = CHUNK_SIZE } = {}) {
        const total = bytes.byteLength;
        if (total <= chunkSize) {
            await this.call(this.fileUrl(path), { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes }, 'envoi');
            onProgress?.(total, total);
            return;
        }
        const id = `envolees-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const uploadUrl = `${this.server}/remote.php/dav/uploads/${encodeURIComponent(this.userId)}/${id}`;
        const destination = { Destination: this.fileUrl(path), 'OC-Total-Length': String(total) };
        await this.call(uploadUrl, { method: 'MKCOL', headers: destination }, 'envoi (préparation)');
        try {
            let index = 1;
            for (let offset = 0; offset < total; offset += chunkSize, index++) {
                const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, total));
                const send = () => this.call(`${uploadUrl}/${String(index).padStart(5, '0')}`, { method: 'PUT', headers: { ...destination, 'Content-Type': 'application/octet-stream' }, body: chunk }, 'envoi');
                try { await send(); } catch (error) { if (error.code !== 'network') throw error; await send(); }
                onProgress?.(Math.min(offset + chunkSize, total), total);
            }
            await this.call(`${uploadUrl}/.file`, { method: 'MOVE', headers: destination }, 'envoi (assemblage)');
        } catch (error) {
            await request(this.fetch, uploadUrl, { method: 'DELETE', headers: this.headers }).catch(() => undefined);
            throw error;
        }
    }

    /** Télécharge un fichier. */
    async download(path) {
        const response = await this.call(this.fileUrl(path), { method: 'GET' }, 'téléchargement');
        return new Uint8Array(await response.arrayBuffer());
    }

    /** Révoque le mot de passe d'application de cet appareil (déconnexion). */
    async revoke() {
        const response = await request(this.fetch, `${this.server}/ocs/v2.php/core/apppassword`, { method: 'DELETE', headers: { ...this.headers, 'OCS-APIRequest': 'true' } });
        return response.ok;
    }
}
