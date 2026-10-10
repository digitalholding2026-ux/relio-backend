# Contrat d'intégration — Relio frontend ↔ Relio backend

**Version du document :** 2.0.0
**Version de l'API :** `v1`
**Statut :** MVP pédagogique implémenté (chantier 7) — 3 leçons, 12 exercices

Ce document est la référence partagée entre les deux dépôts. La spécification
machine-lisible est `openapi.yaml`, dans le dépôt backend.

---

## 1. Principe

Le frontend est un **client HTTP** du backend. Il n'accède jamais directement à
la base de données et ne contient aucune donnée pédagogique embarquée.

```
relio-frontend (Vercel, public)
        │
        │  HTTPS + JSON
        ▼
relio-backend (Railway)
```

---

## 2. Base URL

| Côté | Variable | Exemple |
|---|---|---|
| Frontend | `API_BASE_URL` | `https://relio-backend.up.railway.app` |

> ⚠️ **Point technique important côté Next.js.**
> Une variable d'environnement n'est lisible dans le code **côté navigateur**
> que si son nom commence par `NEXT_PUBLIC_`. Le chantier impose le nom
> `API_BASE_URL`, qui reste donc **inaccessible au client**.
>
> La résolution retenue : `API_BASE_URL` est lue dans un **composant serveur**
> (`app/page.tsx`), puis transmise à un composant client via une prop. Le build
> Vercel n'effectue **aucun appel réseau**, donc il ne casse jamais si l'API est
> indisponible.
>
> Conséquence : `API_BASE_URL` est une variable **serveur** du frontend.
> Ce n'est pas un défaut — une URL d'API n'a pas vocation à être secrète,
> mais elle n'a pas vocation à être dans le bundle non plus.

---

## 3. Routes disponibles

| Méthode | Chemin | Usage | Accès |
|---|---|---|---|
| `GET` | `/health` | Sonde de disponibilité | Public |
| `GET` | `/api/v1` | Version et état de l'API | Public |
| `GET` | `/api/v1/parcours` | Blocs d'exercices et semaine d'ouverture | Public |
| `GET` | `/api/v1/exercices/:id` | Énoncé d'un exercice (jamais la réponse) | Public |
| `GET` | `/api/v1/exercices/:id/indice/:palier` | Un indice, palier 1 à 3 | Public |
| `POST` | `/api/v1/corrections` | Corrige une réponse, ne stocke rien | Public |
| `POST` | `/api/v1/progression` | Statut par objectif, sans persistance | Public |

> **Changement de contrat (v2.0.0).** Le champ `status` de `GET /api/v1` vaut
> désormais `mvp-pedagogique` au lieu de `socle`. La valeur `socle` signifiait
> « aucune fonctionnalité pédagogique » : elle ne décrit plus l'API. Le client
> `relio-frontend` compare des chaînes, il n'est donc pas cassé — mais le
> frontend doit être redéployé avec la nouvelle API pour éviter d'afficher un
> état périmé.

---

## 4. Formats de réponse

### 4.1 Succès

`GET /health` → `200`
```json
{
  "status": "ok",
  "name": "relio-backend",
  "version": "0.1.0",
  "environment": "production",
  "uptimeSeconds": 42,
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`GET /api/v1` → `200`
```json
{
  "name": "relio-backend",
  "apiVersion": "v1",
  "status": "mvp-pedagogique",
  "documentation": "voir docs/CONTRAT-API.md dans le dépôt, et openapi.yaml",
  "endpoints": [
    { "method": "GET", "path": "/health",  "description": "Sonde de disponibilité." },
    { "method": "GET", "path": "/api/v1",  "description": "Version et état de l’API." }
  ]
}
```

### 4.2 Erreurs — format unique

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route inconnue : GET /inconnu"
  }
}
```

| Code HTTP | `error.code` | Cas |
|---|---|---|
| `404` | `NOT_FOUND` | Route inexistante |
| `403` | `BAD_REQUEST` | Exercice d'un bloc pas encore ouvert — **s'applique à l'énoncé, à l'indice et à la correction** |
| `400` | `BAD_REQUEST` | Requête mal formée, ou statut hors du vocabulaire fermé |
| `422` | `BAD_REQUEST` | Réponse d'élève illisible — message destiné à l'élève |
| `500` | `INTERNAL_ERROR` | Erreur serveur — **aucun détail technique renvoyé** |

### Garde-fou calendrier

Le bloc B1 s'ouvre en semaine 1, B2 en semaine 5, B3 en semaine 10. Ce contrôle
s'applique à **toutes** les routes qui touchent un exercice, et pas seulement à
la liste du parcours : sans cela, un identifiant deviné ou une URL connue
permettrait de faire travailler une leçon qui n'a pas encore été enseignée —
exactement ce que le chantier 6 a établi comme risque principal (F2).

### Statut : vocabulaire fermé

`POST /api/v1/progression` n'accepte que `correcte`, `partielle`, `fausse` et
`indeterminee`. Toute autre valeur est **refusée en 400**. Le statut vient du
client : l'accepter sans contrôle permettrait d'introduire dans le calcul de
progression des états que le modèle n'a pas le droit d'émettre — `non_acquis`
en particulier, que la règle « un objectif non testé reste `non_evalue` »
interdit explicitement.

---

## 5. Codes HTTP pertinents

| Code | Signification pour le frontend |
|---|---|
| `200` | Succès |
| `404` | Route inconnue — **signale un contrat désynchronisé** |
| `500` | Panne serveur — message générique, journalisée côté serveur |
| `502` / `503` | Injoignable (réseau, service arrêté, Railway en redémarrage) |

---

## 6. Comportement quand l'API est indisponible

**Règle absolue : le frontend ne doit jamais inventer une réponse serveur.**

| Situation | Affichage attendu |
|---|---|
| Réponse `200` | « API joignable » + version |
| `404` sur `/api/v1` | « Contrat désynchronisé » — le backend est en retard |
| `500` | « Erreur du service » |
| Timeout / `fetch` rejeté / `CORS` bloqué | « API indisponible » + indication de vérifier l'URL |

Le frontend affiche **toujours un état** : il n'affiche jamais « connecté »
sans réponse réelle.

---

## 7. CORS

| Règle | Valeur |
|---|---|
| Configuration | `CORS_ORIGINS` côté backend, liste d'origines séparées par des virgules |
| Production | Le caractère joker `*` est **refusé au démarrage** |
| Origines vides | Aucun appel navigateur cross-origin n'est accepté — avertissement journalisé |
| Appels sans en-tête `Origin` | Acceptés (curl, sonde Railway/Vercel) — ce ne sont pas des appels navigateur |

> ⚠️ Chaque prévisualisation Vercel obtient une URL différente
> (`relio-frontend-abc123.vercel.app`). Une liste CORS stricte la bloquera.
> Décision à trancher avant d'utiliser les prévisualisations.

---

## 8. Versionnement

- Les routes métier sont préfixées par **`/api/v1`**.
- `/health` reste **hors version** : c'est une sonde d'infrastructure, elle ne
  doit pas casser lors d'un changement de version.
- Un changement incompatible ⇒ nouvelle version (`/api/v2`), jamais de
  modification silencieuse d'une route existante.

---

## 9. Ce qui n'existe pas encore

| Domaine | État |
|---|---|
| Authentification | ❌ Non implémentée — hors périmètre du MVP |
| Persistance / PostgreSQL | ❌ Non implémentée — **délibérément** : la durée de conservation des réponses n'est pas arbitrée, donc rien n'est écrit |
| Parcours d'exercices (B1, B2, B3) | ✅ Implémenté — 12 exercices originaux |
| Correction sur trois axes | ✅ Implémenté — justesse / forme / statut |
| Diagnostic initial (mini-évaluation) | ❌ Hors périmètre : il porte sur L8, hors MVP |
| Tuteur IA | ❌ **Aucun appel IA.** Aucun fournisseur branché |
| Contenu BEPC | ❌ **Interdit.** Ni stocké, ni exposé, ni référencé |
| Données d'élèves | ❌ Aucune collectée |

---

## 10. Variables d'environnement ajoutées

| Variable | Défaut | Rôle |
|---|---|---|
| `ANNEE_SCOLAIRE_DEBUT` | `2025-09-01` | Premier jour de la semaine 1. Le référentiel annuel donne le mois, pas le jour : cette date est une approximation documentée, et elle se règle sans redéploiement du code. |
| `DATE_NAVIGATION_TEST` | *(absente)* | Force la date courante. **Usage de test uniquement** — ne pas définir en production. |

---

## 11. Points laissés ouverts (chantier 7)

Ces points ne sont pas tranchés : le code les signale plutôt que de décider.

| # | Point | Traitement dans le code |
|---|---|---|
| 1 | **Forme canonique** : l'ensemble exact des écritures acceptables pour une réponse « juste » | `formeRespectee: null` quand la règle n'est pas arbitrée ; `lectureArbitree: false` est renvoyé au client |
| 2 | **Lecture « juste mais mal formé »** : `partielle` (A.3) ou erreur ? | Lecture A.3 appliquée et signalée via `pointsArbitrage: ["lecture-partielle-a3"]` |
| 3 | **Durée de conservation des réponses** | Aucune persistance : la progression est recalculée à la volée |
| 4 | **Comptes élèves, accès enseignant, tuteur IA** | Hors périmètre, non implémentés |

---

*Maintaineur : équipe Relio. Toute évolution de ce contrat doit modifier
`openapi.yaml` **et** ce document dans le même commit.*