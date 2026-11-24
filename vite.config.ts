// Version web d'Envolées (PWA) : une seule application, deux interfaces (ordinateur / mobile).
// Le code de l'application de bureau (App.tsx, components/, domain/, fileFormat/, shared/…) est
// importé tel quel depuis le dossier parent : il n'est ni copié ni modifié.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..') // projet Electron (source partagée)

const { version } = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

// Fichiers de l'application de bureau servis tels quels par la version web.
// clé = chemin publié, valeur = fichier source (relatif au projet)
const ROOT_FILES: Record<string, string> = {
  'fonts.css': 'public/fonts.css',
  'Fonts/Poppins-Regular.ttf': 'public/Fonts/Poppins-Regular.ttf',
  'Fonts/Poppins-Medium.ttf': 'public/Fonts/Poppins-Medium.ttf',
  'Fonts/Poppins-SemiBold.ttf': 'public/Fonts/Poppins-SemiBold.ttf',
  'Fonts/Poppins-Bold.ttf': 'public/Fonts/Poppins-Bold.ttf',
  'guide/index.html': 'guide/index.html',
}

// Politique de sécurité du contenu (même esprit que l'application de bureau) :
// aucun script ni ressource venant d'Internet ; images locales, data: et blob: (images des classes).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const MIME: Record<string, string> = { '.css': 'text/css', '.ttf': 'font/ttf', '.html': 'text/html; charset=utf-8' }

/** Polices et guide de l'application de bureau : servis en développement, copiés au build. */
const rootFiles = (): Plugin => ({
  name: 'envolees-root-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\//, '')
      const source = ROOT_FILES[url]
      if (!source) return next()
      res.setHeader('Content-Type', MIME[path.extname(url)] ?? 'application/octet-stream')
      res.end(readFileSync(path.join(ROOT, source)))
    })
  },
  generateBundle() {
    for (const [fileName, source] of Object.entries(ROOT_FILES)) {
      this.emitFile({ type: 'asset', fileName, source: readFileSync(path.join(ROOT, source)) })
    }
  },
})

/**
 * Styles de base de l'interface de bureau (barres de défilement, cases à cocher, impression du
 * livret…) : ils vivent dans le bloc <style> d'index.html de l'application de bureau. On les reprend
 * à la source plutôt que de les recopier.
 */
const desktopBaseStyles = (): Plugin => ({
  name: 'envolees-desktop-base-styles',
  transformIndexHtml() {
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    const match = /<style>([\s\S]*?)<\/style>/.exec(html)
    if (!match) throw new Error("Bloc <style> introuvable dans l'index.html de l'application de bureau")
    return [{ tag: 'style', attrs: { 'data-source': 'desktop' }, children: match[1], injectTo: 'head' }]
  },
})

const contentSecurityPolicy = (): Plugin => ({
  name: 'envolees-web-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' },
  ],
})

const listFiles = (dir: string, prefix = ''): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full, `${prefix}${name}/`) : [`${prefix}${name}`]
  })

/**
 * Service worker : précharge tous les fichiers de l'application (fonctionnement hors ligne).
 * La liste et la version sont calculées au build à partir des fichiers réellement produits.
 */
const serviceWorker = (): Plugin => ({
  name: 'envolees-service-worker',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const hash = createHash('sha256')
    const files = new Set<string>()
    for (const [fileName, output] of Object.entries(bundle)) {
      if (fileName.endsWith('.map')) continue
      files.add(fileName)
      hash.update(fileName)
      hash.update(output.type === 'chunk' ? output.code : output.source)
    }
    for (const fileName of listFiles(path.join(HERE, 'public'))) {
      files.add(fileName)
      hash.update(fileName)
      hash.update(readFileSync(path.join(HERE, 'public', fileName)))
    }
    files.delete('index.html')
    const precache = ['./', ...[...files].sort().map(f => `./${f}`)]
    const template = readFileSync(path.join(HERE, 'src/sw.js'), 'utf8')
    const source = template
      .replace('__ENVOLEES_VERSION__', JSON.stringify(`${version}-${hash.digest('hex').slice(0, 12)}`))
      .replace('__ENVOLEES_PRECACHE__', JSON.stringify(precache, null, 2))
    this.emitFile({ type: 'asset', fileName: 'sw.js', source })
  },
})

export default defineConfig({
  root: HERE,
  base: './', // fonctionne à la racine d'un domaine comme dans un sous-dossier (GitHub Pages)
  publicDir: path.join(HERE, 'public'),
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), rootFiles(), desktopBaseStyles(), contentSecurityPolicy(), serviceWorker()],
  css: {
    // Tailwind analyse tout le projet : classes de l'interface de bureau et de la version web.
    postcss: { plugins: [tailwindcss({ base: ROOT })] },
  },
  server: {
    fs: { allow: [ROOT] },
  },
  build: {
    outDir: path.join(HERE, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
})
