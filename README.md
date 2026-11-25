# Envolées — version web (ordinateur et tablette)

La version web **est l'application Envolées**. Elle a les mêmes écrans et les mêmes fonctions que l'application de bureau : classe, compétences, ateliers et QR codes, mode élève, rapports, livret, paramètres. Elle fonctionne dans un navigateur, sur ordinateur comme sur tablette (Android, iPad), et s'installe comme une application (PWA). Elle fonctionne hors ligne. Les données restent sur l'appareil.

Elle ouvre les mêmes fichiers `.envolees` que l'application de bureau, dans les deux sens.

## Utilisation au doigt

Seule la façon d'utiliser l'application s'adapte au toucher, sans fonction ajoutée ni retirée. Ces réglages ne s'appliquent qu'aux écrans tactiles : à la souris, l'application est identique à la version de bureau.

- **Taille des commandes :** 40 px au moins au doigt, et 24 px pour les cases à cocher.
- **Saisie :** texte des champs à 16 px, sinon l'iPad agrandit la page à chaque saisie.
- **Actions habituellement révélées au survol de la souris :** elles restent visibles. Cela concerne :
  - modifier ou supprimer un élève ;
  - les actions de l'arbre des compétences ;
  - les cases de sélection ;
  - la suppression de la photo d'un atelier.
- **Infobulles :** jamais au doigt ; elles restent affichées au survol de la souris (ou du stylet) et au clavier.
- **Taille des QR codes :** la poignée de redimensionnement se manipule au doigt.
- **Tablette en portrait :** les onglets passent sur une deuxième ligne. La fiche élève s'adapte à la largeur de l'écran.
- **Réorganisation des compétences :** au doigt, on utilise les boutons Monter / Descendre et « Déplacer vers… » plutôt que le glisser-déposer.

Ces adaptations sont faites dans le code de l'application de bureau, avec les variantes Tailwind `pointer-coarse:` et `max-lg:`. Elles profitent aussi aux ordinateurs à écran tactile.

## Ce qui diffère de l'application de bureau

| Fonction | Version web |
|---|---|
| Enregistrement | Dans le navigateur de l'appareil (IndexedDB) ; 3 copies de sécurité. Avec Chrome et Edge sur ordinateur, la classe peut aussi être liée à un fichier `.envolees` réécrit à chaque enregistrement. |
| Nuage | **Assisté.** Nuage n'accepte pas les requêtes venant d'un site (pas d'en-têtes CORS). Sur tablette, le menu ouvre le partage vers l'application Nextcloud, ou le sélecteur de fichiers du système. Sur ordinateur, il télécharge le fichier et ouvre Nuage dans un onglet. Une demande d'autorisation est prête : [docs/demande-nuage-cors.md](docs/demande-nuage-cors.md). |
| Livret PDF | Impression du navigateur (« Enregistrer au format PDF ») ; export par lot : une impression par élève. |
| Fermeture avec modifications | Confirmation du navigateur, puis la fenêtre « Enregistrer avant de quitter ? » de l'application. |

**Sur iPad, installez l'application :** dans Safari, Partager › « Sur l'écran d'accueil ». Sinon, Safari efface les données d'un site après 7 jours sans visite.

## Commandes

Dans ce dossier, lancez `npm install` une fois, puis :

```bash
npm run dev        # serveur de développement
npm run build      # version de production dans dist/
npm run check      # types + tests unitaires
npm run test:e2e   # build + tests de bout en bout (ordinateur, puis tablette au toucher)
npm run sync       # met à jour app/ depuis le projet Electron
```

`app/` est une **copie générée** de l'application de bureau, produite par `npm run sync` : ne la modifiez pas. Toute modification de l'interface se fait dans le projet Electron, puis on relance `npm run sync`.

## Déploiement (GitHub Pages)

Ce dossier se publie seul : son contenu devient la racine du dépôt GitHub. Le workflow `.github/workflows/deploy.yml` vérifie, construit et publie à chaque envoi sur `main`. Une nouvelle version s'annonce par un bandeau « Recharger ».

## Tests de bout en bout

`npm run test:e2e` s'exécute dans le Chromium d'Electron.

**Scénario ordinateur (souris) :**
- ouverture d'une classe et affichage des photos ;
- présence de tous les onglets ;
- enregistrement ;
- Nuage dans les deux sens ;
- livret PDF ;
- fonctionnement hors ligne.

**Scénario tablette (événements tactiles réels, paysage puis portrait) :**
- validation d'une compétence au doigt ;
- mode élève (entrée, caméra simulée, sortie avec le code PIN) ;
- sur chaque écran, en paysage et en portrait :
  - aucune cible tactile de moins de 40 px ;
  - aucune commande réservée au survol ;
  - rien de coupé à droite ;
  - tous les onglets visibles.

Le scénario `audit` (`E2E_ONLY=audit`) liste les défauts tactiles sans échouer. Ajoutez `E2E_TOUCH=0` pour comparer avec l'utilisation à la souris.

Restent à vérifier sur un vrai iPad et une vraie tablette Android : la caméra du mode élève, le partage vers Nextcloud, le glisser-déposer.
