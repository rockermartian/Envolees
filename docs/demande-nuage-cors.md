# Demande à l'équipe apps.education.fr — autoriser l'envoi vers Nuage depuis la version web d'Envolées

**Objet :** autorisation CORS sur Nuage pour une application web éducative (Envolées)

Bonjour,

Je développe **Envolées**, une application libre et gratuite de suivi des compétences des élèves de maternelle. Elle existe en application pour ordinateur et en version web installable, utilisable sur ordinateur et sur tablette : https://rockermartian.github.io/envolees/.

Les données des élèves ne quittent jamais l'appareil de l'enseignant : la version web n'a pas de serveur, elle fonctionne entièrement dans le navigateur. Nous voulons que les enseignants puissent **sauvegarder leurs classes dans Nuage** et les retrouver d'un appareil à l'autre, plutôt que sur des services non souverains.

## Ce qui fonctionne déjà

L'application pour ordinateur utilise déjà Nuage, de la même façon que le client de synchronisation Nextcloud :

- connexion par « Login Flow v2 » (identifiant académique, puis mot de passe d'application propre à l'appareil, révocable dans Paramètres › Sécurité) ;
- envoi et lecture des fichiers par WebDAV, dans un dossier « Envolées ».

Les tests sur nuage05.apps.education.fr sont concluants.

## Ce qui bloque

Depuis la version web, le navigateur refuse ces mêmes requêtes. Nuage ne renvoie aucun en-tête `Access-Control-Allow-Origin`, et les requêtes de vérification préalable (OPTIONS) reçoivent une erreur 401 ou 405. Les enseignants doivent donc télécharger le fichier, puis le déposer à la main dans Nuage.

## Ce que nous demandons

Autoriser **l'origine `https://rockermartian.github.io`** (et elle seule) sur les adresses suivantes :

| Adresse | Méthodes |
|---|---|
| `/index.php/login/v2` et `/index.php/login/v2/poll` | POST |
| `/remote.php/dav/files/*` | PROPFIND, MKCOL, PUT, GET, DELETE |
| `/remote.php/dav/uploads/*` (envoi par morceaux) | MKCOL, PUT, MOVE, DELETE |
| `/ocs/v2.php/cloud/user` | GET |
| `/ocs/v2.php/core/apppassword` (déconnexion) | DELETE |

Les en-têtes de requête à autoriser sont : `Authorization`, `Content-Type`, `Depth`, `Destination`, `OC-Total-Length`, `OCS-APIRequest`. La réponse aux requêtes OPTIONS doit valoir 200 ou 204, sans authentification.

Une autre solution, si elle vous convient mieux : l'application Nextcloud **WebAppPassword** (apps.nextcloud.com/apps/webapppassword), configurée pour cette seule origine.

## Sécurité

- Aucune donnée ne passe par un serveur tiers : le navigateur de l'enseignant communique directement avec Nuage.
- Chaque appareil reçoit son propre mot de passe d'application, visible et révocable par l'enseignant.
- La page web applique une politique de sécurité du contenu stricte : aucun script extérieur, aucune ressource venant d'Internet.
- L'autorisation demandée porte sur une seule origine, publiée en HTTPS.

## Signalement au passage

`POST /index.php/login/v2` renvoie une **erreur 500** quand l'en-tête `User-Agent` contient un caractère accentué (par exemple « Envolées »). Sans accent, la requête aboutit. Envolées contourne le problème, mais d'autres clients pourraient le rencontrer.

Je reste à votre disposition pour tout test ou précision.

Cordialement,

*[Nom, fonction, école, académie]*
