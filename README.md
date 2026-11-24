# Envolées — version web (ordinateur et mobile)

Application web **installable** (PWA) : elle fonctionne hors ligne et s'ajoute à l'écran d'accueil d'un téléphone ou au menu Démarrer. Les données restent sur l'appareil : rien n'est envoyé sur Internet.

Une seule application avec deux interfaces :

| Interface | Pour | Contenu |
|---|---|---|
| **Ordinateur** | ordinateur, tablette | L'application de bureau complète (sa copie dans `app/`, sans modification) |
| **Mobile** | téléphone, en classe | Élèves, validation en un geste (avec photo), validation groupée, passages d'atelier, export |

L'interface est choisie selon la largeur de l'écran (moins de 768 px : mobile). On peut changer à tout moment : « Version mobile » dans la boîte *Ouvrir une classe*, « Version ordinateur » dans l'onglet *Plus*, ou `?ui=mobile` / `?ui=desktop` dans l'adresse. Le choix est mémorisé.

## Pourquoi une seule application et pas deux dépôts

Les deux interfaces partagent tout : les données, le format `.envolees`, les règles métier, le stockage, le déploiement et l'installation. Deux dépôts doubleraient la maintenance sans rien apporter. Le code propre à chaque interface reste séparé (`src/desktop/`, `src/mobile/`), et le navigateur ne charge que l'interface affichée.

## Un dossier autonome

Ce dossier se suffit à lui-même : il peut devenir un dépôt GitHub à lui seul. Le code de l'application de bureau dont il a besoin y est **recopié** dans `app/`, avec les polices et le guide dans `public/`. Rien n'est importé du dossier parent.

- **Ne modifiez pas `app/`** : le code se modifie dans le projet Electron.
- Après une modification de l'application de bureau, lancez `npm run sync` dans `web_app/`, puis committez. La commande recopie `app/`, les polices, le guide et le programme de test, et aligne la version et les dépendances sur le projet Electron.
  - Si `web_app/` est encore dans le projet Electron : `npm run sync`.
  - Sinon : `npm run sync -- <chemin du projet Electron>`.

## Commandes

Dans ce dossier : `npm install` une fois, puis :

```bash
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # version de production dans web_app/dist
npm run preview    # sert le build (pour tester l'installation et le hors-ligne)
npm run check      # types + tests unitaires
npm run test:e2e   # build + tests de bout en bout dans Chromium (Electron) : ordinateur puis mobile
npm run icons      # régénère les icônes PNG à partir de public/icons/icon.svg
npm run sync       # recopie le code de l'application de bureau dans app/
```

`test:e2e` et `icons` se servent d'Electron comme navigateur piloté. Electron n'est pas une dépendance de la version web : ces deux commandes l'utilisent s'il est installé (ici, ou dans le projet Electron voisin). Sinon : `npm install --no-save electron`, ou `ELECTRON_PATH=<exécutable>`.

`test:e2e` utilise `../classe-test-lourde.envolees` s'il existe, sinon une classe générée. `E2E_FILE=<fichier>` choisit une autre classe, et `E2E_SHOTS=<dossier>` enregistre des captures d'écran.

## Déploiement sur GitHub Pages

1. Créez un dépôt GitHub et envoyez-y **le contenu de ce dossier**, à la racine du dépôt, sur la branche `main`. Le dossier caché `.github/` doit être inclus.
2. Dans le dépôt, allez dans **Settings › Pages › Source** et choisissez « **GitHub Actions** ».
3. Chaque envoi sur `main` lance [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) : il installe les dépendances (`npm ci`), vérifie (types et tests), construit puis publie. L'adresse est `https://<compte>.github.io/<dépôt>/`.

Le glisser-déposer sur github.com ne transfère pas toujours les dossiers cachés. Si `.github/` manque, utilisez Git ou GitHub Desktop, ou créez le fichier sur github.com (Add file › Create new file › `.github/workflows/deploy.yml`) et collez-y son contenu.

Les chemins sont relatifs (`base: './'`), donc l'application fonctionne à la racine d'un domaine comme dans un sous-dossier. Une nouvelle version publiée affiche un bandeau « Recharger » : elle n'est jamais appliquée pendant une saisie.

**Navigateurs** : Chrome et Edge 103 ou plus, Firefox 113 ou plus, Safari 16.4 ou plus (iPhone et iPad : iOS 16.4 ou plus).

**Installer** : dans Chrome ou Edge, utilisez l'icône d'installation de la barre d'adresse. Sur Android, menu › *Installer l'application*. Sur iPhone et iPad, dans Safari : Partager › *Sur l'écran d'accueil*.

## Où sont les données, et comment passer d'un appareil à l'autre

- Chaque classe est enregistrée **dans le navigateur de l'appareil** (IndexedDB). Les images sont stockées une seule fois, même si plusieurs classes les partagent.
- L'interface ordinateur enregistre comme l'application de bureau : enregistrement automatique (30 s après la dernière modification) et indicateur cliquable. L'interface mobile enregistre chaque modification en moins d'une seconde, et immédiatement quand l'application passe en arrière-plan.
- **Copies de sécurité** : comme sur l'application de bureau, 3 copies par classe, au plus une toutes les 30 minutes. Dans l'interface ordinateur : Réglages › « Ouvrir le dossier des copies de sécurité ».
- **Changer d'appareil** : le fichier `.envolees` est le même que celui de l'application de bureau, dans les deux sens. On l'exporte (ordinateur : Menu › Enregistrer sous ; mobile : Plus › Exporter ou Partager), puis on l'ouvre sur l'autre appareil. Si une classe du même nom existe déjà, l'application propose de la remplacer (l'ancienne version est gardée en copie de sécurité) ou de garder les deux.
- **Fichier lié** (Chrome et Edge sur ordinateur) : une classe peut être liée à un fichier `.envolees` de l'ordinateur, réécrit à chaque enregistrement comme dans l'application de bureau. Si ce fichier est dans un dossier synchronisé (OneDrive, Drive…), il sert de sauvegarde. Une fois l'application installée, un double-clic sur un `.envolees` l'ouvre dans Envolées.
- Une classe ne s'ouvre que dans un seul onglet à la fois : deux onglets s'écraseraient mutuellement.

⚠️ Un navigateur peut effacer les données d'un site dans de rares cas (manque de place, « effacer les données de navigation »). L'application demande au navigateur de les protéger (Plus › Stockage), mais **exporter régulièrement le fichier `.envolees`** reste la vraie sauvegarde. Chaque classe indique sa date de dernier export et si elle a été modifiée depuis.

## Différences avec l'application de bureau

| Fonction | Version web |
|---|---|
| Livret en PDF | Passe par l'impression du navigateur : choisir « Enregistrer au format PDF ». Même mise en page, car ce sont les mêmes styles d'impression. |
| Export de tous les livrets | Une boîte d'impression par élève, avec le nom du fichier déjà proposé. Pour tout exporter d'un coup dans un dossier, utiliser l'application de bureau. |
| Fichier `.envolees` réécrit à chaque enregistrement | Chrome et Edge sur ordinateur seulement. Ailleurs, export manuel. |
| Fermeture avec modifications non enregistrées | Le navigateur demande confirmation, et la fenêtre « Enregistrer avant de quitter ? » de l'application s'affiche. |
| Mode élève (QR codes) | Identique. La caméra demande l'autorisation du navigateur (HTTPS, assuré par GitHub Pages). |
| Photos HEIC d'iPhone | L'appareil photo, ouvert depuis l'application, fournit du JPEG. Une image HEIC choisie dans la galerie peut être refusée (même message que sur ordinateur). |

## Architecture

```
web_app/
├── .github/workflows/deploy.yml    Déploiement sur GitHub Pages
├── index.html, vite.config.ts      Build : service worker généré, CSP
├── app/                            Copie de l'application de bureau (générée par npm run sync)
├── public/                         manifest.webmanifest, icônes, polices, guide
├── scripts/                        sync-desktop.mjs, make-icons.mjs, find-electron.mjs
├── src/
│   ├── main.tsx                    Démarrage : stockage des images, choix de l'interface
│   ├── uiMode.ts                   Ordinateur / mobile
│   ├── sw.js                       Service worker (hors ligne, mises à jour)
│   ├── platform/                   Ce que fait le processus principal d'Electron, version navigateur
│   │   ├── db.ts                   IndexedDB
│   │   ├── webImages.ts            Images (ImageBackend de images/imageStore.ts)
│   │   ├── archive.ts              Lecture/écriture .envolees avec shared/envoleesArchive.js
│   │   ├── library.ts              Classes du navigateur, copies de sécurité, ménage des images
│   │   ├── session.ts              Classe ouverte (un onglet à la fois), import, enregistrement
│   │   ├── fileAccess.ts           Fichiers : sélection, fichier lié, téléchargement, partage
│   │   ├── dialogs.tsx             Boîtes de dialogue (à la place des fenêtres natives)
│   │   └── ClassLibrary.tsx        Liste des classes
│   ├── desktop/
│   │   ├── electronBridge.tsx      window.electronAPI réalisé avec le navigateur
│   │   └── mountDesktop.tsx        Monte App.tsx tel quel
│   └── mobile/                     Interface mobile (écrans, modèle testé, enregistrement continu)
└── tests/                          Vitest (archive, modèle), fixtures/ (générateur de classes,
                                    programme 2025), e2e/ (Chromium d'Electron)
```

**Le code de bureau est repris tel quel.** La seule transformation de la copie : `__APP_VERSION__` devient `import.meta.env.VITE_APP_VERSION`. L'interface ordinateur ne parle au système que par `window.electronAPI` (voir `electron/preload.js` dans le projet Electron) : la version web fournit la même interface (`src/desktop/electronBridge.tsx`) et pose un stockage d'images navigateur (`setImageBackend`). L'interface mobile appelle directement les modules métier (`domain/`, `fileFormat/`) : mêmes règles, mêmes données, mêmes tests.

Performances, mesurées sur la classe de test de 76 Mo (2 147 photos) dans Chromium :
- ouverture : environ 1,5 s (les photos ne sont pas recopiées en mémoire, ce sont des tranches du fichier) ;
- enregistrement dans le navigateur : environ 0,1 s ;
- export du fichier : environ 1,5 s.

L'archive est assemblée à partir des images déjà stockées, sans les relire. La classe synthétique de 170 Mo s'écrit en 0,06 s et se relit en 0,35 s (test unitaire).

## Tests

- `npm run check` : 14 tests unitaires, dont la compatibilité des fichiers dans les deux sens avec l'application de bureau et la performance sur la classe de 170 Mo.
- `npm run test:e2e` : 28 vérifications dans un vrai Chromium, l'application étant servie sous un sous-chemin comme sur GitHub Pages.
  - Ordinateur : ouverture, photos, enregistrement, export relu par le lecteur de bureau (images identiques octet par octet), impression, rechargement, fonctionnement hors ligne.
  - Mobile : ouverture, validation en un geste, Annuler, photo, validation groupée, export, absence de défilement horizontal, console sans erreur.
