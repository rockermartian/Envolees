# Envolées — version web (ordinateur et tablette)

Application web **installable** (PWA) de suivi des compétences en maternelle, conçue pour le **toucher** (tablette Android, iPad) comme pour la souris et le clavier. Elle fonctionne hors ligne. Les données restent sur l'appareil et ne le quittent que si l'enseignant les envoie (Nuage, partage, fichier).

Elle ouvre les mêmes fichiers `.envolees` que l'application Envolées pour ordinateur, dans les deux sens.

## Fonctions

| | Version web | Application pour ordinateur |
|---|---|---|
| Élèves : liste, fiche, ajout et modification, photo (appareil photo de la tablette) | ✅ | ✅ |
| Validation d'une compétence au toucher (date, section, photo de preuve), Annuler | ✅ | ✅ |
| Validation groupée | ✅ | ✅ |
| Passages d'atelier à valider, journal | ✅ | ✅ |
| **Mode élève** (photo de l'enfant, QR code de l'atelier, code PIN pour sortir) | ✅ | ✅ |
| Import d'un programme `.competences` | ✅ | ✅ |
| **Nuage** : envoyer et ouvrir une classe | ✅ assisté (voir ci-dessous) | ✅ direct |
| Édition du programme, création des ateliers et QR codes, rapports, livret PDF, groupes de soutien | — | ✅ |

### Disposition

- **Tablette en paysage, ordinateur :** rail de navigation à gauche ; liste des élèves et fiche côte à côte.
- **Tablette en portrait :** la liste, puis la fiche en plein écran (bouton Retour).
- Toutes les commandes font au moins 44 px, et aucune action n'apparaît seulement au survol de la souris.

## Nuage dans la version web

Nuage n'accepte pas, pour l'instant, les requêtes venant d'un autre site : il ne renvoie pas d'en-têtes CORS (vérifié le 24/11/2026). Un site web ne peut donc pas y écrire directement. La version web **assiste** l'enseignant :

| | Envoyer vers Nuage | Ouvrir depuis Nuage |
|---|---|---|
| **Tablette** | Le partage de la tablette s'ouvre. On choisit l'application **Nextcloud** (connectée à Nuage), puis le dossier « Envolées ». | Le sélecteur de fichiers de la tablette s'ouvre. Nextcloud y apparaît comme un emplacement. |
| **Ordinateur** | Le fichier est téléchargé et Nuage s'ouvre dans un onglet : il suffit d'y déposer le fichier. Avec Chrome ou Edge, la classe peut aussi être enregistrée directement dans le dossier Nuage synchronisé de l'ordinateur (client Nextcloud). | Nuage s'ouvre dans un onglet pour télécharger la classe, puis on choisit le fichier. On peut aussi la choisir directement dans le dossier synchronisé. |

**Préparer une tablette une fois pour toutes :** installez l'application **Nextcloud** (App Store ou Google Play). Connectez-la avec l'adresse `nuage.apps.education.fr` et votre identifiant académique.

L'application pour ordinateur, elle, envoie directement : connexion par le navigateur, puis Menu › Envoyer vers Nuage.

Pour obtenir l'envoi direct dans la version web, une demande est prête à envoyer à l'équipe apps.education.fr : [docs/demande-nuage-cors.md](docs/demande-nuage-cors.md). Le client Nuage partagé (`core/shared/nuageClient.js`) fonctionne déjà dans un navigateur : il ne reste qu'à brancher l'interface quand l'autorisation sera donnée.

## Données et sauvegarde

- Chaque classe est enregistrée **dans le navigateur de l'appareil** (IndexedDB), à chaque modification. Il n'y a pas de bouton « Enregistrer ».
- 3 copies de sécurité sont gardées par classe.
- L'onglet **Classe** indique la date de la dernière sauvegarde (Nuage ou fichier) et si la classe a été modifiée depuis.
- **Sur iPad, installez l'application** (Safari › Partager › « Sur l'écran d'accueil »). Sinon, Safari efface les données d'un site après 7 jours sans visite. L'application le rappelle sur l'écran d'accueil.
- Une classe ne s'ouvre que dans un seul onglet à la fois.

## Commandes

Dans ce dossier : `npm install` une fois, puis :

```bash
npm run dev        # serveur de développement
npm run build      # version de production dans dist/
npm run check      # types + tests unitaires
npm run test:e2e   # build + tests de bout en bout dans Chromium (voir « Tests »)
npm run sync       # met à jour core/ depuis le projet Electron
npm run icons      # régénère les icônes PNG
```

## Code partagé avec l'application pour ordinateur (`core/`)

`core/` est une **copie générée** du code partagé avec le projet Electron :
- règles métier (`domain/`) ;
- format des fichiers (`fileFormat/`, `shared/`) ;
- client Nuage, images, types.

Le projet Electron reste la référence. L'interface web, elle, est distincte et ne copie aucun composant de l'application de bureau. Après une modification du code partagé, lancez `npm run sync` (projet Electron dans le dossier parent), ou `npm run sync -- <chemin>`. Ne modifiez pas `core/` à la main.

## Déploiement (GitHub Pages)

Ce dossier se publie seul : son contenu est la racine du dépôt GitHub.
1. Envoyez-le sur la branche `main`.
2. Le workflow `.github/workflows/deploy.yml` vérifie le code, le construit et le publie.

Réglage unique du dépôt : Settings › Pages › Source : « GitHub Actions ».

Une nouvelle version s'annonce par un bandeau « Recharger ». Elle n'est jamais appliquée pendant une saisie.

## Tests

- **Tests unitaires** (`npm run check`) : compatibilité des fichiers avec l'application de bureau, performance sur une classe de 170 Mo, calculs de l'interface (dont « Tom L. » / « Tom V. » pour les prénoms identiques).
- **Tests de bout en bout** (`npm run test:e2e`), dans le Chromium d'Electron. Electron est utilisé s'il est installé ici ou dans le projet voisin ; sinon `npm install --no-save electron`.
  - **Ordinateur (souris, clavier) :**
    - ouverture d'un fichier, photos, validation, Ctrl+Z, validation groupée ;
    - envoi vers Nuage (fichier téléchargé, puis relu à l'identique par le lecteur de bureau) ;
    - ouverture depuis Nuage ;
    - hors ligne.
  - **Tablette (événements tactiles réels, portrait puis paysage) :**
    - parcours tablette d'ouverture depuis Nuage ;
    - validation au toucher, photo ;
    - mode élève (caméra simulée, QR code, pavé PIN) ;
    - mesure de la taille de toutes les cibles tactiles.

**À vérifier sur appareil réel** (non automatisable) : caméra et partage vers l'application Nextcloud sur un vrai iPad et une vraie tablette Android.

Navigateurs : Chrome et Edge 103 ou plus, Firefox 113 ou plus, Safari et iPadOS 16.4 ou plus.
