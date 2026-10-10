/**
 * Types du contenu pédagogique du MVP.
 *
 * Les identifiants sont **stables et techniques** : aucun intitulé ne sert de
 * clé. Le contenu est versionné avec le code, et chaque élément porte sa
 * provenance.
 */

import type { Valeur } from '../lib/analyseur-reponse.js';

/** Type de grandeur attendue — détermine comment la réponse sera analysée. */
export type TypeReponse = 'rationnelle' | 'expression' | 'racine';

/**
 * Forme exigée par l'énoncé.
 *
 * `null` signifie : **aucune forme particulière demandée**. Dans ce cas le
 * jugement de forme n'est pas rendu — `Consequence` ne le remplit pas, et
 * aucune conclusion pédagogique n'est tirée de la forme.
 */
export type RegleForme = 'fraction_irreductible' | 'produit_de_facteurs' | 'racine_a_sqrt_b' | null;

/** Grandeur attendue, exprimée dans la même syntaxe que celle de l'élève. */
export type ReponseAttendue = string;

/** Un objectif opérationnel du périmètre MVP. */
export interface Objectif {
  readonly id: string;
  readonly libelle: string;
  readonly leconId: string;
  /** Objectifs qui doivent être rencontrés avant celui-ci. */
  readonly prerequis: readonly string[];
}

/** Un bloc de leçons, ouvert à une semaine donnée du référentiel annuel. */
export interface Bloc {
  readonly id: string;
  readonly titre: string;
  readonly leconId: string;
  readonly leconIntitule: string;
  readonly volumeHoraireH: number;
  /** Semaine du référentiel annuel à partir de laquelle le bloc est proposé. */
  readonly semaineDebut: number;
  readonly objectifs: readonly string[];
}

/** Palier d'indice — jamais la solution complète d'emblée. */
export interface Indice {
  readonly palier: 1 | 2 | 3;
  readonly texte: string;
}

/** Piège documenté : réponse attendue par l'élève, signature d'erreur associée. */
export interface Piege {
  readonly reponse: string;
  readonly signature: string;
  readonly commentaire: string;
}

export interface Exercice {
  readonly id: string;
  readonly blocId: string;
  /** Rang de difficulté à l'intérieur de son objectif (1 = plus accessible). */
  readonly rang: number;
  readonly objectifs: readonly string[];
  readonly enonce: string;
  readonly consigne: string;
  readonly typeReponse: TypeReponse;
  readonly reponseAttendue: ReponseAttendue;
  readonly regleForme: RegleForme;
  /**
   * `false` quand la règle de forme employée **n'est pas tranchée** par les
   * documents validés. La correction est alors rendue, mais l'API signale que
   * la lecture est provisoire — elle ne présente jamais ce cas comme définitif.
   */
  readonly regleFormeArbitree: boolean;
  readonly indices: readonly Indice[];
  readonly pieges: readonly Piege[];
  /**
   * Traçabilité obligatoire : un exercice du contenu élève ne référence
   * **jamais** une source d'épreuve officielle.
   */
  readonly origine: 'originale';
  readonly sourceBepc: null;
}

/** Statut d'une réponse d'élève — vocabulaire fermé, repris de la spécification. */
export const STATUTS_REPONSE = ['correcte', 'partielle', 'fausse', 'indeterminee'] as const;

export type StatutReponse = (typeof STATUTS_REPONSE)[number];

/**
 * Contrôle d'appartenance au vocabulaire fermé.
 *
 * Le serveur ne se contente pas de typer : il **refuse** à l'exécution toute
 * valeur extérieure. C'est ce qui empêche un client de faire entrer un état
 * inventé — `acquis`, `niveau_3`, `non_acquis` — dans le calcul de progression,
 * où il produirait un statut que le moteur n'a jamais eu le droit d'émettre.
 */
export function estStatutReponse(valeur: string): valeur is StatutReponse {
  return (STATUTS_REPONSE as readonly string[]).includes(valeur);
}

/** Correction d'une réponse, sur trois axes **séparés**. */
export interface Correction {
  readonly exerciceId: string;
  /** 1. Justesse mathématique — égalité algébrique ou arithmétique exacte. */
  readonly mathemathiquementJuste: boolean;
  /**
   * 2. Respect de la forme demandée. `null` = **indéterminable**, faute de
   * règle arbitrée. Jamais `false` par défaut : on ne conclut pas à une faute
   * de forme qu'on n'a pas le droit de juger.
   */
  readonly formeRespectee: boolean | null;
  /** 3. Statut d'interprétation, dérivé des deux axes précédents. */
  readonly statut: StatutReponse;
  readonly signatureErreur: string | null;
  readonly explication: string;
  /** Vrai si la forme n'était pas déterminable : l'API le signale explicitement. */
  readonly formeIndeterminee: boolean;
}

/** Forme d'évaluation d'une valeur analysée. */
export type FormeReponse = 'irreductible' | 'non_irreductible' | 'produit' | 'non_produit' | 'a_sqrt_b';

export type ValeurAttendueCalculee = Valeur;