/**
 * Objectifs opérationnels et blocs du MVP — périmètre de trois leçons.
 *
 * 🟡 Les objectifs opérationnels sont des **déductions**, pas des compétences
 * officielles : le référentiel annuel ne contient aucun champ `competences`,
 * `objectifs` ni `prerequis` (vérifié sur les 14 leçons). Ils sont repris tels
 * quels du périmètre retenu, sans réécriture ni enrichissement.
 *
 * Aucune question de ce fichier ne reproduit un énoncé d'épreuve : les
 * énoncés sont originaux et `sourceBepc` vaut `null` partout.
 */

import type { Bloc, Objectif } from './types.js';

/**
 * Référentiel annuel d'origine : `data/referentiel-maths-3e-cm-2025-2026.json`
 * dans le dépôt documentaire, sha256 `f766f412…`. Les semaines de début
 * ci-dessous en sont extraites ; elles ne sont pas inventées ici.
 */
export const SEMAINE_DEBUT = {
  B1: 1, // L1 Calcul littéral      — S1, S2
  B2: 5, // L3 Racines carrées      — S5, S6
  B3: 10, // L5 Calcul numérique    — S10, S11
} as const;

export const OBJECTIFS: readonly Objectif[] = [
  {
    id: 'OO-L1-1',
    libelle: 'Développer et réduire une expression algébrique',
    leconId: 'LEC-CM-MATH-3E-2025-2026-01',
    prerequis: [],
  },
  {
    id: 'OO-L1-2',
    libelle: 'Factoriser une expression',
    leconId: 'LEC-CM-MATH-3E-2025-2026-01',
    // La factorisation s'appuie sur le développement : c'est le même
    // vocabulaire (distributivité) appliqué à l'envers.
    prerequis: ['OO-L1-1'],
  },
  {
    id: 'OO-L3-1',
    libelle: "Simplifier une expression contenant des racines carrées",
    leconId: 'LEC-CM-MATH-3E-2025-2026-03',
    prerequis: [],
  },
  {
    id: 'OO-L5-1',
    libelle: 'Calculer sur les nombres rationnels',
    leconId: 'LEC-CM-MATH-3E-2025-2026-05',
    prerequis: [],
  },
  {
    id: 'OO-L5-2',
    libelle: 'Rédiger un résultat sous forme irréductible',
    leconId: 'LEC-CM-MATH-3E-2025-2026-05',
    // Réduire suppose de savoir calculer.
    prerequis: ['OO-L5-1'],
  },
] as const;

export const BLOCS: readonly Bloc[] = [
  {
    id: 'B1',
    titre: 'Calcul littéral',
    leconId: 'LEC-CM-MATH-3E-2025-2026-01',
    leconIntitule: 'Calcul littéral',
    volumeHoraireH: 7,
    semaineDebut: SEMAINE_DEBUT.B1,
    objectifs: ['OO-L1-1', 'OO-L1-2'],
  },
  {
    id: 'B2',
    titre: 'Racines carrées',
    leconId: 'LEC-CM-MATH-3E-2025-2026-03',
    leconIntitule: 'Racines carrées',
    volumeHoraireH: 7,
    semaineDebut: SEMAINE_DEBUT.B2,
    objectifs: ['OO-L3-1'],
  },
  {
    id: 'B3',
    titre: 'Calcul numérique',
    leconId: 'LEC-CM-MATH-3E-2025-2026-05',
    leconIntitule: 'Calcul numérique',
    volumeHoraireH: 9,
    semaineDebut: SEMAINE_DEBUT.B3,
    objectifs: ['OO-L5-1', 'OO-L5-2'],
  },
] as const;

export function trouverObjectif(id: string): Objectif | undefined {
  return OBJECTIFS.find((objectif) => objectif.id === id);
}

export function trouverBloc(id: string): Bloc | undefined {
  return BLOCS.find((bloc) => bloc.id === id);
}

/** Objectifs dont tous les prérequis sont rencontrés dans `rencontres`. */
export function prerrequisSatisfaits(objectifId: string, rencontres: ReadonlySet<string>): boolean {
  const objectif = trouverObjectif(objectifId);
  if (!objectif) return false;
  return objectif.prerequis.every((prerequis) => rencontres.has(prerequis));
}