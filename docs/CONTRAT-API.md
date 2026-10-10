# Contrat d'intégration — Relio frontend ↔ Relio backend

**Version du document :** 1.0.0
**Version de l'API :** `v1`
**Statut :** socle technique — **aucune fonctionnalité pédagogique n'est implémentée**

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

**Aucune route métier n'existe à ce jour.**

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
  "status": "socle",
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
| `400` | `BAD_REQUEST` | Requête mal formée |
| `500` | `INTERNAL_ERROR` | Erreur serveur — **aucun détail technique renvoyé** |

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
| Authentification | ❌ Non implémentée |
| Persistance / PostgreSQL | ❌ Non implémentée — documenté comme étape ultérieure |
| Diagnostic, exercices, progression | ❌ Non implémentés |
| Tuteur IA | ❌ **Aucun appel IA.** Aucun fournisseur branché |
| Contenu BEPC | ❌ **Interdit.** Ni stocké, ni exposé, ni référencé |
| Données d'élèves | ❌ Aucune collectée |

---

*Maintaineur : équipe Relio. Toute évolution de ce contrat doit modifier
`openapi.yaml` **et** ce document dans le même commit.*