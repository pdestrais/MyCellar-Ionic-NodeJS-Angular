## But
Fournir aux agents IA les informations minimales et spécifiques pour être immédiatement productifs sur ce dépôt MyCellar (Ionic + NodeJS).

## Aperçu rapide (Big picture)
- `client/` : application Ionic/Angular (UI). Build produit -> `client/www` (static) servi par le serveur Node.
- `server/` : backend Express qui gère authentification (JWT), Cloudant (DB), envoi d'e-mails (Mailjet) et stockage d'objets via IBM COS (modules dans `server/s3/`).
- Déploiement simple : builder le client (`client/www`) puis démarrer le serveur racine qui sert `client/www`.

## Commandes essentielles
- Backend (racine du repo) : `npm run start` (prod), `npm run startdev` (copie `.env.dev` -> `.env` puis `node --inspect server/server.js`).
- Frontend (dossier `client/`) : `npm start` (dev `ng serve`), `npm run build` (build), `npm run buildProd` (build production). Pour pack/electron : `npm run buildElectron` puis `npm run dist`.
- Flow de déploiement local recommandé : `cd client && npm run buildProd` puis à la racine `npm run start`.

## Fichier d'environnement et variables importantes
- Le serveur charge les variables via `dotenv`. Voir `.env-template`. Variables attendues (non exhaustif) : `secret`, `dbProtocol` / `dbprotocol` (attention au casing), `dbHost`, `dbHostServiceUsername`, `dbHostServicePassword`, `MJ_APIKEY_PUBLIC`, `MJ_APIKEY_PRIVATE`, `emailAdmin`.
- Remarque importante : le code utilise parfois `dbProtocol` (camelCase) et parfois `dbprotocol` (lowercase) — vérifier/corriger si vous automatisez les déploiements.

## Points d'intégration et patterns spécifiques
- Base de données : Cloudant REST via `axios` (URL construite dans `server/server.js`). Requêtes `_find` et création de bases sont faites depuis le serveur.
- Stockage d'objets : code dédié dans `server/s3/` : `s3Client.js` (création client IAM/HMAC), `object.js`, `bucket.js`, `endpoints.js`. Utiliser ces modules pour upload/download d'images.
- Uploads fichiers : `multer` avec `memoryStorage()` est utilisé (upload en mémoire puis envoi vers COS). Voir `server/server.js` endpoints d'upload.
- Templates e-mail : `server/templates/*.html` + `jsrender` pour rendu côté serveur (`sendEMail` endpoints utilisent `node-mailjet`).
- Auth : JWT créé dans `server/server.js` (utilise `process.env.secret`) et inclut `dbserver`, `dbUser`, `dbPassword` dans le token payload.

## Conventions de code ou pièges observés
- Le serveur sert statiquement `client/www` en production : chemin calculé via `process.cwd() + '/client/www'` (cf. `server/server.js`). Toujours builder le client avant d'exécuter le serveur.
- Scripts utilitaires dans la racine copient `.env.dev` / `.env.prod` vers `.env` — n'exécutez pas ces scripts sans vérifier le contenu des fichiers `.env.*`.
- Coquilles à connaître : variations `dbProtocol` vs `dbprotocol`. Un agent doit vérifier l'existence de la variable et tolérer les deux formes.

## Exemples concrets pour les tâches courantes
- Démarrer en dev fullstack :
  - `cd client && npm install && npm start` (dev frontend)
  - depuis la racine, préparer `.env` (ou `cp .env.dev .env`) puis `npm run startdev` pour backend avec inspect.
- Builder pour prod local :
  - `cd client && npm run buildProd`
  - à la racine `npm run start` (serve le contenu de `client/www`).

## Où chercher quand vous êtes perdu
- Routes et logique API : `server/server.js` (fichier long, seule source d'API côté serveur).
- Stockage objet / cloud : `server/s3/*`.
- Templates d'e-mails : `server/templates/`.
- Frontend : `client/src/` (Angular + Ionic) et scripts de packaging Electron dans `client/electron/`.

## Règles pour un agent IA
- Ne pas modifier la logique de construction automatique sans tester : d'abord build local et vérifier `client/www`.
- Toujours lire et respecter `server/.env-template` et confirmer les clés d'environnement avant d'exécuter des scripts qui les copient.
- Lorsque vous automatisez la configuration, normalisez la casse des variables d'environnement (`dbProtocol` vs `dbprotocol`) et loggez les valeurs manquantes.
- Pour tout changement touchant l'authentification ou les envois d'e-mails : exécuter un test end-to-end minimal (env de test ou mocks) avant de proposer un merge.

## Besoin d'éclaircissements
Indiquez les zones floues (par ex. valeurs d'env, instance COS, Cloudant provisioning) et je mettrai à jour ces instructions. Voulez-vous que je corrige la divergence `dbProtocol`/`dbprotocol` dans `server/server.js` ?
