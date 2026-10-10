/**
 * Progression par objectif — règle des trois.
 *
 * Règle : si un élève réussit `n` trials sans erreur, la borne supérieure à
 * 95 % du taux d'erreur réel est d'environ `3/n`.
 *
 * | items | 0 erreur | borne sup. | conclusion          |
 * |-------|----------|-----------|---------------------|
 * | 1     | 0        | 300 %     | aucune              |
 * | 2     | 0        | 150 %     | aucune              |
 * | 3     | 0        | 100 %     | aucune              |
 * | 4     | 0        | 75 %      | information         |
 *
 * Deux conséquences non négociables, appliquées ici :
 *
 * 1. **`non_evalue` n'est jamais dégradé.** Un objectif sans donnée reste
 *    `non_evalue`. Il ne devient **jamais** `non_acquis` : l'absence de
 *    réponse est un manque de données, pas une difficulté.
 * 2. **`correcte` seul ne prouve rien.** Trois réponses justes au fil de
 *    l'eau sur des exercices différents ne suffisent pas à conclure un acquis ;
 *    la spécification réserve cette conclusion au diagnostic complémentaire,
 *    qui **n'existe pas dans ce MVP**. `acquis_confirme` est donc hors
 *    périmètre, et le moteur ne l'atteint pas.
 */

import type { StatutReponse } from '../contenu/types.js';

export const STATUTS_OBJECTIF = [
  'non_evalue',
  'signal',
  'hypothese',
  'constat',
] as const;

export type StatutObjectif = (typeof STATUTS_OBJECTIF)[number];

export interface ReponseExercice {
  readonly exerciceId: string;
  readonly objectifId: string;
  readonly statut: StatutReponse;
}

export interface ProgressionObjectif {
  readonly objectifId: string;
  readonly statut: StatutObjectif;
  readonly itemsCorrects: number;
  readonly itemsPartiels: number;
  readonly itemsFausses: number;
  /** Borne supérieure du taux d'erreur à 95 %, en pourcentage arrondi. */
  readonly borneSuperieureErreurPct: number | null;
  /** Aucune donnée : le statut ne bouge pas. */
  readonly sansDonnee: boolean;
}

/** Un `partielle` est une donnée : c'est une réponse juste hors forme demandée. */
function compteCommeErreur(statut: StatutReponse): boolean {
  return statut === 'fausse' || statut === 'indeterminee';
}

/**
 * Statut d'un objectif à partir des réponses observées.
 *
 * - 0 donnée → `non_evalue`, jamais dégradé.
 * - 1 erreur isolée → `signal`.
 * - 2 erreurs ou plus → `hypothese`.
 * - 3 items ou plus avec un motif cohérent → `constat`.
 */
export function evaluerObjectif(
  objectifId: string,
  reponses: readonly ReponseExercice[],
): ProgressionObjectif {
  const items = reponses.filter((r) => r.objectifId === objectifId);

  const correctes = items.filter((r) => r.statut === 'correcte').length;
  const partielles = items.filter((r) => r.statut === 'partielle').length;
  const fausses = items.filter((r) => compteCommeErreur(r.statut)).length;
  const total = items.length;

  const vide: ProgressionObjectif = {
    objectifId,
    statut: 'non_evalue',
    itemsCorrects: 0,
    itemsPartiels: 0,
    itemsFausses: 0,
    borneSuperieureErreurPct: null,
    sansDonnee: true,
  };

  if (total === 0) return vide;

  const borneSuperieureErreurPct = correctes === total ? Math.round((3 / correctes) * 100) : null;

  let statut: StatutObjectif;
  if (fausses === 0 && partielles === 0 && total < 4) {
    // Succès sans erreur, mais trop peu d'items pour dire quoi que ce soit.
    statut = 'non_evalue';
  } else if (fausses === 1) {
    statut = 'signal';
  } else if (fausses >= 2) {
    statut = 'hypothese';
  } else if (total >= 3) {
    statut = 'constat';
  } else {
    // Des réponses justes et au moins une partielle : le motif est cohérent,
    // mais l'effectif reste faible — on reste au niveau « signal ».
    statut = 'signal';
  }

  return {
    objectifId,
    statut,
    itemsCorrects: correctes,
    itemsPartiels: partielles,
    itemsFausses: fausses,
    borneSuperieureErreurPct,
    sansDonnee: false,
  };
}

/** Évalue plusieurs objectifs à partir d'un journal de réponses. */
export function evaluerProgression(
  reponses: readonly ReponseExercice[],
  objectifsIds: readonly string[],
): ProgressionObjectif[] {
  return objectifsIds.map((objectifId) => evaluerObjectif(objectifId, reponses));
}

/** Vrai si tous les prérequis de l'objectif sont atteints au moins au niveau `signal`. */
export function prerequisAtteints(
  objectifId: string,
  progression: readonly ProgressionObjectif[],
  prerequis: readonly string[],
): boolean {
  const niveaux: Readonly<Record<StatutObjectif, number>> = {
    non_evalue: 0,
    signal: 1,
    hypothese: 2,
    constat: 3,
  };
  return prerequis.every((id) => {
    const trouve = progression.find((p) => p.objectifId === id);
    return trouve !== undefined && niveaux[trouve.statut] >= 1;
  });
}