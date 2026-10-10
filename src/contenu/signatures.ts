/**
 * Catalogue **fermé** des signatures d'erreur.
 *
 * Ce catalogue n'est pas étendu ici : il reprend celui validé pour la mission 3.
 * Toute réponse qui n'y correspond pas exactement est classée `hors_perimetre`,
 * et `hors_perimetre` signifie « activité générique de reprise » — jamais une
 * interprétation spécifique. On ne devine pas une difficulté qu'on n'a pas
 * observée.
 */

export const SIGNATURES = [
  'signe_non_reparti',
  'denominateur_non_reduit',
  'signe_non_distribue',
  'termes_non_collectes',
  'non_factorise',
  'signe_inverse_dans_difference_carre',
  'signe_perdu_en_resolution',
  'resolution_incompletee',
  'carre_parfait_non_extrait',
  'coefficient_multiplicatif_oublie',
  'base_racine_erronee',
  'hors_perimetre',
] as const;

export type SignatureErreur = (typeof SIGNATURES)[number];

export const SIGNATURE_PAR_DEFAUT: SignatureErreur = 'hors_perimetre';

export function estSignatureValide(valeur: string): valeur is SignatureErreur {
  return (SIGNATURES as readonly string[]).includes(valeur);
}

/** Conséquence pédagogique : ce que la signature oriente. Aucune neauthorize un niveau. */
export const LEÇONS_CANDIDATES: Readonly<Record<SignatureErreur, readonly string[]>> = {
  signe_non_reparti: ['L5'],
  denominateur_non_reduit: ['L5'],
  signe_non_distribue: ['L1'],
  termes_non_collectes: ['L1'],
  non_factorise: ['L1'],
  signe_inverse_dans_difference_carre: ['L1'],
  signe_perdu_en_resolution: ['L8'],
  resolution_incompletee: ['L8'],
  carre_parfait_non_extrait: ['L3'],
  coefficient_multiplicatif_oublie: ['L3'],
  base_racine_erronee: ['L3'],
  hors_perimetre: [],
};