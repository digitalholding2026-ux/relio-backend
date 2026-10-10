# `backend/` — Emplacement réservé

**Dossier vide par intention.** Rien n'y a été écrit, et c'est voulu.

Ce dossier accueillera l'API et la logique métier de Relio **lorsque le chantier 2
sera lancé sur instruction du propriétaire**. Il ne contient aujourd'hui
**aucun code**.

---

## Ce qui viendra ici

- API HTTP, validation des requêtes
- Logique métier et **moteur de recommandation pédagogique**
- Traitement des diagnostics, des sondes, des exercices et des résultats
- Persistance (profils élèves, progression)
- Intégration du fournisseur d'IA — **clé côté serveur uniquement**

## Ce qui viendra ici depuis le dépôt actuel

| Fichier | Pourquoi |
|---|---|
| `data/referentiel-maths-3e-cm-2025-2026.json` | **Seule donnée** transposée vers un dépôt d'application |

SHA-256 attendu, à vérifier après copie :
```
f766f41240335955821bb3e00a27c618299ffbc6cf34c984622025ea15dbc4f0
```

## Ce qui ne viendra **pas** ici

| Élément | Raison |
|---|---|
| `data/inventaire-questions-bepc-2025-2026.json` | Contenu BEPC **et** statut provisoire non validé |
| Les 4 PDF du BEPC | Droits de reproduction non établis |
| `source-progression-maths-3e.jpg` | Reste dans `Relio` pour la traçabilité |
| `outils/*.py`, `outils/*.mjs` | Chaîne de production, conservée dans `Relio` |

Les 4 scripts n'ont **aucune dépendance externe** et continuent de fonctionner
dans `Relio` sans aucune modification.

## Le moteur de recommandation

À écrire en **fonctions pures**, testables sans base de données ni serveur.
C'est la partie du code qui sera amenée à changer après arbitrage
pédagogique : ne pas la câbler au coût dès le départ.

---

## État

| Élément | Valeur |
|---|---|
| Code | Aucun |
| `package.json` | Absent |
| Framework | 🔴 **Non décidé** — Fastify recommandé ; NestJS (mission 1) défendable |
| Base de données | PostgreSQL (Railway) — persistence justifiée : filesystem Railway éphémère |
| Déploiement prévu | Railway |

---

*Contexte : `docs/audit-migration-architecture.md`,
`docs/architecture-cible.md`, `docs/plan-migration-depots.md`.*