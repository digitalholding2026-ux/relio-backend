# relio-backend

API et logique métier de **Relio** — préparation du BEPC (Mathématiques, 3e).

**Statut : socle technique. Aucune fonctionnalité pédagogique n'est implémentée.**

---

## ⚠️ Ce que ce dépôt n'est PAS

Ce dépôt ne contient **pas** de moteur de diagnostic, pas de tuteur IA, pas de
gestion d'exercices, pas de base de données et pas d'authentification.

L'API expose **deux routes** : une sonde de santé et un point d'entrée versionné.
Le champ `status` de `/api/v1` vaut `socle` et le dit explicitement.

Aucun appel à un fournisseur d'IA n'est effectué. Aucune clé n'est requise.

---

## Stack

| Élément | Choix | Raison |
|---|---|---|
| Langage | **TypeScript** (strict) | Le moteur de diagnostic manipule des structures imbriquées ; une faute de nom de champ doit échouer au build, pas chez un élève |
| Framework | **Fastify 5** | Peu de dépendances, schémas rapides, excellent support de la CI |
| CORS | `@fastify/cors` | Liste blanche explicite |
| Base de données | **Aucune à ce stade** | Voir « Persistance » ci-dessous |
| Build | `tsc` → `dist/` | Aucune dépendance à l'exécution du build |

**Aucune dépendance n'est requise pour démarrer l'API** en l'état.

---

## Prérequis

- **Node.js 20 ou supérieur** (Railway : préciser Node 22)
- npm

---

## Installation

```bash
npm install
cp .env.example .env
```

---

## Variables d'environnement

| Variable | Obligatoire | Défaut | Rôle |
|---|---|---|---|
| `PORT` | Non | `3000` | Port d'écoute. **Railway l'injecte** |
| `HOST` | Non | `0.0.0.0` | Interface. Obligatoire en conteneur |
| `NODE_ENV` | Non | `development` | `development` \| `production` \| `test` |
| `CORS_ORIGINS` | Non | *(vide)* | Origines autorisées, séparées par des virgules |

Voir `.env.example`.

### Validation au démarrage

`src/config.ts` valide la configuration **avant** d'ouvrir le port. En cas
d'erreur, le processus s'arrête avec un message explicite. Sont refusés :

- `PORT` non entier ou hors plage 0–65535 ;
- `NODE_ENV` hors des trois valeurs autorisées ;
- `CORS_ORIGINS` contenant `*` **en production** ;
- `CORS_ORIGINS` contenant une origine mal formée (il faut un schéma complet).

> **Pourquoi refuser de démarrer ?** Démarrer avec une configuration invalide
> produit une API qui répond sur le mauvais port, ou qui accepte toutes les
> origines. Un échec au démarrage vaut mieux.

### Non renseignés à ce stade

`IA_PROVIDER_KEY` et `DATABASE_URL` sont documentés dans `.env.example` mais
**vides et non utilisés**. Ils ne doivent être ajoutés qu'au moment où la
fonctionnalité correspondante existe.

---

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm run build` | Compile TypeScript vers `dist/` |
| `npm start` | Démarre le serveur compilé (`node dist/server.js`) |
| `npm run typecheck` | Vérification de types, sans émission |

**Pour Railway** — Build : `npm run build` · Start : `npm start`.
Le port est lu depuis `PORT`, jamais codé en dur.

---

## Structure

```
src/
├── server.ts              Démarrage : charge la config, ouvre le port, gère les signaux
├── app.ts                 Construction de l'instance Fastify (n'ouvre aucun port)
├── config.ts              Lecture + validation de l'environnement
├── lib/errors.ts          Erreurs applicatives et correspondance HTTP
├── plugins/
│   ├── cors.ts            CORS piloté par CORS_ORIGINS
│   └── error-handler.ts   Gestion centralisée des erreurs et du 404
└── routes/
    ├── index.ts           Point d'entrée des routes
    ├── health.ts          Ré-exports publics
    └── v1.ts              /health et /api/v1

docs/CONTRAT-API.md       Contrat d'intégration frontend ↔ backend
openapi.yaml               Spécification OpenAPI 3.1 (machine-lisible)
```

**Séparation `app.ts` / `server.ts`** : `buildApp()` construit sans écouter.
Cela permet de tester l'application sans ouvrir de port.

---

## Routes

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/health` | Sonde de disponibilité |
| `GET` | `/api/v1` | Version et état de l'API |

Voir `docs/CONTRAT-API.md`.

---

## Sécurité

| Mesure | État |
|---|---|
| Aucun secret dans le dépôt | ✅ `.gitignore` exclut `.env`, `*.pem`, `*.key`, `credentials.json` |
| CORS en liste blanche | ✅ `*` refusé en production |
| Erreurs sans détail technique | ✅ Stack traces journalisées côté serveur, jamais renvoyées |
| Clé IA côté serveur uniquement | ✅ Aucun appel IA implémenté |
| `.env.example` sans secret | ✅ |

---

## Persistance — étape ultérieure

**Aucune base de données n'est configurée dans ce socle.**

Justification : rien dans les deux routes actuelles ne dépend d'un stockage.
Ajouter PostgreSQL maintenant serait de la complexité prématurée.

Elle **sera nécessaire** dès qu'il y aura des profils d'élèves, des réponses
enregistrées ou un historique de progression, car le système de fichiers de
Railway est **éphémère** : un stockage fichier perdrait les données à chaque
redéploiement.

⚠️ **À vérifier avant mise en ligne** : sur les offres gratuites, Railway
fournit un PostgreSQL **éphémère**. Les données d'élèves seraient supprimées.

---

## Déploiement sur Railway

Le propriétaire réalise ces étapes (je n'ai pas accès à la plateforme).

1. Créer un service depuis le dépôt `relio-backend`.
2. **Build Command** : `npm run build`
3. **Start Command** : `npm start`
4. Définir `CORS_ORIGINS` avec l'origine du frontend (ex. `https://relio-frontend.vercel.app`).
5. Ne **pas** définir `PORT` : Railway l'injecte.
6. Optionnel — Healthcheck Path : `/health`

**Note sécurité :** `CORS_ORIGINS` doit contenir les origines **exactes**.
Chaque prévisualisation Vercel a une URL différente ; décider si l'on les autorise
avant d'utiliser les prévisualisations.

---

*Contrat d'intégration : `docs/CONTRAT-API.md`*