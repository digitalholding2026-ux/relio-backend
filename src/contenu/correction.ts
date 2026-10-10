/**
 * Correction d'une réponse d'élève, sur trois axes **séparés**.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 1. JUSTESSE MATHÉMATIQUE                                            │
 * │    `mathemathiquementJuste` — égalité EXACTE, jamais de comparaison   │
 * │    de chaînes. `4(x-1)(x+2)` et `(2x-2)(2x+4)` sont égaux : la       │
 * │    réponse est juste, quelle que soit son écriture.                  │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ 2. RESPECT DE LA FORME DEMANDÉE                                      │
 * │    `formeRespectee` — propriété de l'**écriture** (`14/12` n'est      │
 * │    pas irréductible). Renvoie `null` — jamais `false` par défaut —    │
 * │    quand la règle de forme applicable n'est pas arbitrée.           │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ 3. INTERPRÉTATION PÉDAGOGIQUE                                       │
 * │    `statut` — conséquence des deux axes, dans les seuls termes       │
 * │    autorisés par la spécification : `correcte`, `partielle`,         │
 * │    `fausse`, `indeterminee`.                                        │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * **Point non arbitré, signalé et non codé comme définitif.**
 * Lorsqu'une réponse est mathématiquement juste mais pas dans la forme
 * demandée, la spécification valide deux lectures concurrentes : le tableau
 * par question de `specification-diagnostic-initial.md` l'illustre en rouge,
 * tandis que `regles-recommandation-pedagogique.md` (A.3) définit
 * explicitement `partielle` = « juste mais pas dans la forme demandée » et
 * précise qu'elle **ne compte jamais comme fausse**.
 *
 * Le moteur applique A.3 — la seule règle explicite et la plus prudente — et
 * **signale** la lecture retenue à l'appelant via `lectureARbitree`. La
 * correction n'est jamais présentée comme définitivement arbitrée.
 */

import {
  analyserExpressionReponse,
  analyserRacine,
  analyserRationnel,
  estIrreductible,
  ReponseInvalide,
  sontEgales,
  type Valeur,
  type ValeurExpression,
  type ValeurRacine,
  type ValeurRationnelle,
} from '../lib/analyseur-reponse.js';
import { ExpressionRefusee, estProduitDeFacteurs } from '../lib/analyseur-expression.js';
import { estEgal, UN, ZERO, type Rational } from '../lib/algebre.js';
import {
  estSignatureValide,
  SIGNATURE_PAR_DEFAUT,
  type SignatureErreur,
} from './signatures.js';
import type { Correction, Exercice } from './types.js';

/** Lecture de la spécification appliquée au cas « juste mais forme non respectée ». */
export const LECTURE_PARTIELLE = 'A.3 — partielle';

export type FormeVerdict = 'conforme' | 'non_conforme' | 'indeterminee';

export interface DetailCorrection {
  readonly exerciceId: string;
  readonly mathemathiquementJuste: boolean;
  readonly forme: FormeVerdict;
  readonly formeRespectee: boolean | null;
  readonly statut: Correction['statut'];
  readonly signatureErreur: SignatureErreur;
  readonly explication: string;
  /** Index affiché, en cas d'indice déjà demandé. */
  readonly indice: number | null;
  /** Nom de l'exercice, pour éviter de transporter tout l'énoncé côté client. */
  readonly objectifId: string;
  readonly lectureArbitree: boolean;
  readonly pointsArbitrage: readonly string[];
}

/** Analyse une saisie selon le type de grandeur attendu par l'exercice. */
function analyserSaisie(exercice: Exercice, saisie: string): Valeur {
  switch (exercice.typeReponse) {
    case 'rationnelle':
      return analyserRationnel(saisie);
    case 'expression':
      return analyserExpressionReponse(saisie);
    case 'racine':
      return analyserRacine(saisie);
    default:
      throw new ReponseInvalide('Type de réponse non pris en charge.');
  }
}

/** Analyse la réponse attendue, avec la même grammaire que la saisie d'élève. */
function analyserAttendu(exercice: Exercice): Valeur {
  return analyserSaisie(exercice, exercice.reponseAttendue);
}

/**
 * Jugement de forme, sur le **seul** critère énoncé dans la consigne.
 *
 * Renvoie `null` quand aucune forme n'est exigée ou quand la règle applicable
 * n'est pas arbitrée : dans ce cas, on ne conclut rien sur la forme.
 */
export function jugerForme(exercice: Exercice, valeur: Valeur): boolean | null {
  if (exercice.regleForme === null) return null;

  if (exercice.regleFormeArbitree === false) return null;

  switch (exercice.regleForme) {
    case 'fraction_irreductible': {
      if (valeur.type !== 'rationnelle') return false;
      const rationnelle = valeur as ValeurRationnelle;
      // Une écriture décimale n'est pas une fraction irréductible, même si
      // elle a exactement la même valeur.
      return rationnelle.forme === 'fraction' && estIrreductible(rationnelle);
    }
    case 'produit_de_facteurs': {
      if (valeur.type !== 'expression') return false;
      const expression = valeur as ValeurExpression;
      return estProduitDeFacteurs(expression.noeud);
    }
    case 'racine_a_sqrt_b': {
      if (valeur.type !== 'racine') return false;
      const racine = valeur as ValeurRacine;
      // `b` sans facteur carré : c'est ce que « simplifie » signifie.
      return racine.radicand === racine.radicandSaisi;
    }
    default:
      return null;
  }
}

/**
 * Forme demandée, en clair pour l'écran de l'élève. `null` quand l'énoncé
 * n'en exige aucune.
 */
export function formeDemandee(exercice: Exercice): string | null {
  switch (exercice.regleForme) {
    case 'fraction_irreductible':
      return 'une fraction irréductible';
    case 'produit_de_facteurs':
      return 'un produit de facteurs du premier degré';
    case 'racine_a_sqrt_b':
      return 'la forme a√b, avec a entier et b sans facteur carré';
    default:
      return null;
  }
}

/** Cherche la signature documentée d'un piège, si la réponse y correspond. */
function signatureDuPiege(exercice: Exercice, valeur: Valeur): SignatureErreur | null {
  for (const piege of exercice.pieges) {
    try {
      const valeurPiege = analyserSaisie(exercice, piege.reponse);
      if (sontEgales(valeur, valeurPiege)) {
        return estSignatureValide(piege.signature) ? piege.signature : SIGNATURE_PAR_DEFAUT;
      }
    } catch {
      // Un piège illisible est ignoré : il ne doit pas faire échouer la
      // correction d'une réponse d'élève parfaitement valide.
      continue;
    }
  }
  return null;
}

function explicationFausse(exercice: Exercice, signature: SignatureErreur): string {
  switch (signature) {
    case 'denominateur_non_reduit':
      return 'Le calcul est bon, mais le résultat doit être réduit. On simplifie le numérateur et le dénominateur par un même nombre.';
    case 'signe_non_reparti':
      return "Attention au signe : il appartient au terme, pas à l'ensemble du calcul.";
    case 'signe_non_distribue':
      return "Le signe « − » doit être distribué à chaque terme de l'expression entre parenthèses.";
    case 'termes_non_collectes':
      return "Il reste des termes à regrouper : on additionne les coefficients d'un même terme.";
    case 'non_factorise':
      return 'Le résultat est exact, mais il est resté sous forme développée. La consigne demande une forme factorisée.';
    case 'signe_inverse_dans_difference_carre':
      return "Dans (a − b)(a + b), le premier facteur garde « − » et le second garde « + ».";
    case 'carre_parfait_non_extrait':
      return 'Un carré parfait se trouve sous la racine : il faut l\'extraire avant d\'additionner.';
    case 'coefficient_multiplicatif_oublie':
      return "Le coefficient devant la racine compte aussi : il faut le multiplier par la valeur extraite.";
    case 'base_racine_erronee':
      return 'Toutes les racines doivent se ramener à la même base avant de les additionner.';
    default:
      return `Reprends la méthode de ${exercice.objectifs.join(', ')} sur un exemple plus simple.`;
  }
}

export interface CorrectionComplete extends DetailCorrection {
  /** Réponse attendue, exposée uniquement côté serveur. */
  readonly valeurAttendue: Valeur;
}

/**
 * Corrige une réponse d'élève.
 *
 * @param indiceDemande nombre de paliers déjà consultation (null = pas d'indice)
 * @throws {ReponseInvalide} si la saisie est illisible — le message est
 *         destiné à l'élève, il ne révèle rien du corrigé.
 */
export function corriger(
  exercice: Exercice,
  saisie: string,
  indiceDemande: number | null = null,
): CorrectionComplete {
  const valeur = analyserSaisie(exercice, saisie);
  const attendue = analyserAttendu(exercice);

  // --- Axe 1 : justesse mathématique, comparaison exacte --------------------
  const juste = sontEgales(valeur, attendue);

  // --- Axe 2 : respect de la forme demandée -------------------------------
  const formeRespectee = jugerForme(exercice, valeur);
  const forme: FormeVerdict =
    formeRespectee === null ? 'indeterminee' : formeRespectee ? 'conforme' : 'non_conforme';

// --- Axe 3 : interprétation ----------------------------------------------
  // La signature est recherchée dans les deux cas : une réponse juste mais mal
  // formée porte elle aussi une lecture pédagogique (c'est tout l'intérêt du
  // statut « partielle »).
  const signatureReconnue = signatureDuPiege(exercice, valeur);

  let statut: Correction['statut'];
  let signatureErreur: SignatureErreur = SIGNATURE_PAR_DEFAUT;
  let explication: string;
  const pointsArbitrage: string[] = [];

  if (!juste) {
    statut = 'fausse';
    signatureErreur = signatureReconnue ?? SIGNATURE_PAR_DEFAUT;
    explication = explicationFausse(exercice, signatureErreur);
    // Une réponse fausse mais écrite dans la forme demandée ne pose pas de
    // question de forme : c'est bien un cas de math.
    if (exercice.regleForme !== null && exercice.regleFormeArbitree === false) {
      pointsArbitrage.push('forme-non-arbitree');
    }
  } else if (forme === 'indeterminee') {
    // Impossible d'arbitrer la forme : on ne conclut pas. Jamais « fausse ».
    statut = exercice.regleForme === null ? 'correcte' : 'indeterminee';
    signatureErreur = SIGNATURE_PAR_DEFAUT;
    explication =
      exercice.regleForme === null
        ? 'La valeur est exacte.'
        : 'La valeur est exacte. La forme demandée n\'a pas pu être vérifiée par le moteur : c\'est ton enseignant qui le confirmera.';
    if (exercice.regleForme !== null) {
      pointsArbitrage.push('forme-non-arbitree');
    }
  } else if (formeRespectee === false) {
    // ---- LE CAS DÉLÉGATÉ --------------------------------------------------
    // Mathématiquement juste, forme non respectée. Lecture A.3 : `partielle`.
    // La signature vient du piège documenté s'il existe ; sinon on ne
    // surinterprète pas et on reste sur la valeur neutre.
    statut = 'partielle';
    signatureErreur = signatureReconnue ?? SIGNATURE_PAR_DEFAUT;
    explication =
      signatureReconnue === null
        ? 'La valeur est exacte, mais la réponse n\'est pas écrite dans la forme demandée.'
        : explicationFausse(exercice, signatureErreur);
    pointsArbitrage.push('lecture-partielle-a3');
  } else {
    statut = 'correcte';
    signatureErreur = SIGNATURE_PAR_DEFAUT;
    explication = 'La valeur et la forme sont conformes.';
  }

  // L'indice n'est jamais la solution complète : le palier 3 s'arrête à la
  // première ligne de résolution.
  let indiceAffiche: number | null = null;
  if (indiceDemande !== null && indiceDemande > 0) {
    indiceAffiche = Math.min(Math.trunc(indiceDemande), exercice.indices.length);
  }

  return {
    exerciceId: exercice.id,
    objectifId: exercice.objectifs[0] ?? '',
    mathemathiquementJuste: juste,
    forme,
    formeRespectee,
    statut,
    signatureErreur,
    explication,
    indice: indiceAffiche,
    // `formeRespectee === false` n'est rendue possible que par une règle
    // explicitement déclarée dans la consigne de l'exercice.
    lectureArbitree: pointsArbitrage.length === 0,
    pointsArbitrage,
    valeurAttendue: attendue,
  };
}

/** Erreurs d'analyse converties en message élève, jamais en trace technique. */
export function messagePourErreur(erreur: unknown): string {
  if (erreur instanceof ReponseInvalide || erreur instanceof ExpressionRefusee) {
    return erreur.message;
  }
  return 'Réponse illisible. Réessaie.';
}

export { estEgal, UN, ZERO };
export type { Rational, Valeur };