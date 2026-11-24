// Version web d'Envolées (PWA) : l'application Envolées elle-même, sur ordinateur et tablette.
// Projet autonome : le code de l'application de bureau est recopié dans app/ (npm run sync).
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(path.join(HERE, 'package.json'), 'utf8'))

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
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  plugins: [react(), contentSecurityPolicy(), serviceWorker()],
  css: {
    // Tailwind analyse app/ (interface de l'application) et src/ (plateforme web).
    postcss: { plugins: [tailwindcss({ base: HERE })] },
  },
  build: {
    outDir: path.join(HERE, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
})
