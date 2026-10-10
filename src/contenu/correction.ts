/**
 * Correction d'une réponse d'élève, sur **quatre axes séparés**.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 1. EXACTITUDE MATHÉMATIQUE                                            │
 * │    `mathemathiquementJuste` — égalité EXACTE, jamais de comparaison   │
 * │    de chaînes. `4(x-1)(x+2)` et `(2x-2)(2x+4)` sont égaux : la       │
 * │    réponse est juste, quelle que soit son écriture.                  │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ 2. RESPECT DE LA CONSIGNE (forme demandée)                            │
 * │    `formeRespectee` — propriété de l'**écriture** (`14/12` n'est      │
 * │    pas irréductible). Renvoie `null` — jamais `false` par défaut —    │
 * │    quand la règle de forme applicable n'est pas arbitrée.            │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ 3. ACHÈVEMENT                                                        │
 * │    `achevement` — le travail est-il terminé ? Une étape correcte      │
 * │    mais inachevée (`√(25×2)`) est exacte **et** inachevée : les      │
 * │    axes 1 et 3 sont indépendants. Renvoie `null` quand le moteur ne  │
 * │    sait pas le déterminer — jamais `false` par défaut.               │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ 4. VERDICT PÉDAGOGIQUE                                              │
 * │    `verdict` — conséquence des trois axes, dans le vocabulaire       │
 * │    confirmé par l'enseignant (décision D5).                          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * **Décision D5 — arbitrée par l'enseignant.**
 *
 * | Cas | Verdict affiché | Condition |
 * |---|---|---|
 * | A | `resultat_juste_consigne_non_respectee` | juste **et** forme non respectée |
 * | B | `partiellement_correct` | juste **et** forme respectée **et** inachevé |
 * | C | `incorrect` | mathématiquement faux |
 * | D | `correct` | juste, achevé, conforme |
 *
 * L'enseignant a tranché le point que les chantiers 6 et 7 avaient laissé
 * ouvert : une réponse exacte hors forme demandée **n'est jamais** déclarée
 * mathématiquement fausse. Elle reçoit son propre verdict, distinct de
 * « partiellement correct », qui reconnaît une étape inachevée.
 *
 * ⚠️ Cette décision **précise** la règle A.3 sans la contredire : A.3
 * définissait `partielle` comme « juste mais pas dans la forme demandée, **ou**
 * étape intermédiaire correcte non achevée », et exigeait qu'elle ne compte
 * ni comme fausse, ni comme correcte. La séparation en deux verdicts conserve
 * exactement cette garantie — les deux cas restent non comptables comme
 * réussite — et donne à l'élève un retour plus précis.
 *
 * Le statut technique (`correcte` / `partielle` / `fausse` / `indeterminee`)
 * est **conservé** : la progression et le vocabulaire pédagogique validé
 * depuis le chantier 7 en dépendent. `verdict` vient s'y ajouter sans les
 * remplacer.
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

/**
 * Verdict pédagogique affiché à l'élève — décision D5.
 *
 * Le libellé lui-même est fourni par le serveur (`libelle`) : le frontend
 * l'affiche tel quel. Il ne peut donc pas diverger de la règle appliquée, et
 * les tests backend peuvent vérifier le texte réellement vu par l'élève.
 */
export const VERDICTS = [
  'correct',
  'partiellement_correct',
  'resultat_juste_consigne_non_respectee',
  'incorrect',
  'a_determiner',
] as const;

export type Verdict = (typeof VERDICTS)[number];

/** Achèvement du travail — jamais `false` par défaut, seulement `null` = inconnu. */
export type Achevement = 'acheve' | 'inacheve' | null;

export interface DetailCorrection {
  readonly exerciceId: string;
  readonly mathemathiquementJuste: boolean;
  readonly forme: FormeVerdict;
  readonly formeRespectee: boolean | null;
  readonly achevement: Achevement;
  readonly statut: Correction['statut'];
  /** Verdict pédagogique, décision D5. */
  readonly verdict: Verdict;
  /** Libellé exact à afficher à l'élève. */
  readonly libelle: string;
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

/**
 * Jugement d'achèvement.
 *
 * Distingue « juste mais le travail n'est pas terminé » de « juste et terminé ».
 * La seule trace d'achèvement inachevée que le MVP sait reconnaître avec
 * fiabilité est le **radicand décomposé en produit** : `√(25×2)` montre que
 * l'élève a trouvé le carré parfait mais n'a pas terminé l'extraction.
 *
 * Renvoie `null` — jamais `false` — dans tous les autres cas : le moteur ne
 * prétend pas savoir qu'un travail est achevé s'il n'a aucun moyen de le
 * vérifier. C'est ce `null` qui produit le verdict « à déterminer ».
 */
function jugerAchevement(exercice: Exercice, valeur: Valeur): Achevement {
  if (exercice.typeReponse !== 'racine') return null;
  if (valeur.type !== 'racine') return null;
  return valeur.radicandDecompose ? 'inacheve' : 'acheve';
}

/**
 * Consigne de forme, redigée pour être reprise telle quelle dans le message.
 *
 * `formeDemandee` sert aussi à l'écran d'exercice (« Réponse attendue : … »)
 * et y est formulée avec l'article. Ici, on ne garde que le complément, sans
 * article : le message complet est alors « … sous la forme <complément> ».
 */
function formeDansLeMessage(exercice: Exercice): string | null {
  switch (exercice.regleForme) {
    case 'fraction_irreductible':
      return 'd’une fraction irréductible';
    case 'produit_de_facteurs':
      return 'd’un produit de facteurs du premier degré';
    case 'racine_a_sqrt_b':
      return 'a√b, avec a entier et b sans facteur carré';
    default:
      return null;
  }
}

/**
 * Libellé et message pédagogique du verdict (décision D5).
 *
 * Les textes validés par l'enseignant sont repris mot pour mot. Seul le nom
 * de la forme attendue est inséré, pour que l'élève sache précisément quoi
 * écrire plutôt qu'un renvoi vague.
 */
function messagePourVerdict(
  verdict: Verdict,
  exercice: Exercice,
): string {
  const forme = formeDansLeMessage(exercice);

  switch (verdict) {
    case 'correct':
      return 'Ta réponse est juste.';
    case 'resultat_juste_consigne_non_respectee':
      return forme === null
        ? 'Ton résultat est mathématiquement juste, mais tu n’as pas respecté la forme demandée.'
        : `Ton résultat est mathématiquement juste, mais tu n’as pas respecté la forme demandée. Écris ta réponse sous la forme ${forme}.`;
    case 'partiellement_correct':
      return 'Ta réponse est partiellement correcte : tu as bien commencé le travail, mais il reste une étape pour le terminer. Continue jusqu’à obtenir une réponse qui ne peut plus être simplifiée.';
    case 'incorrect':
      return 'Ce n’est pas encore juste.';
    case 'a_determiner':
    default:
      return 'Ta réponse est mathématiquement juste, mais la forme demandée n’a pas pu être vérifiée par le moteur : c’est ton enseignant qui le confirmera.';
  }
}

/**
 * Verdict : conséquence des trois axes.
 *
 * Ordre des tests, qui n'est pas décoratif :
 *
 * - `!juste` → `incorrect` (cas C). Une réponse exacte n'arrive **jamais**
 *   ici, quelle que soit son écriture ;
 * - **achèvement inachevé d'abord** (cas B) : un radicand décomposé
 *   (`√(25×2)`) est à la fois juste et mal simplifié. Le traiter comme un
 *   simple cas de forme dit à l'élève « réécris-le autrement », alors que
 *   l'étape qu'il lui reste à faire est précisément l'extraction du carré
 *   parfait. Le cas B est donc prioritaire sur le cas A ;
 * - forme non respectée → cas A ;
 * - `correct`, ou `a_determiner` quand une forme était exigée mais n'a pas pu
 *   être jugée. **Un exercice qui n'exige aucune forme n'est jamais**
 *   `a_determiner` : il n'y a rien à déterminer.
 */
function deriverVerdict(
  juste: boolean,
  formeExigee: boolean,
  formeRespectee: boolean | null,
  achevement: Achevement,
): Verdict {
  if (!juste) return 'incorrect';
  if (achevement === 'inacheve') return 'partiellement_correct';
  if (formeRespectee === false) return 'resultat_juste_consigne_non_respectee';
  if (formeExigee && formeRespectee === null) return 'a_determiner';
  return 'correct';
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

  // --- Axe 3 : achèvement du travail --------------------------------------
  const achevement = jugerAchevement(exercice, valeur);

// --- Axe 4 : interprétation ----------------------------------------------
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
    // ---- CAS A (décision D5) ---------------------------------------------
    // Mathématiquement juste, forme non respectée. La règle A.3 s'applique
    // toujours : `partielle` ne compte ni comme juste ni comme fausse.
    // Le libellé affiché est désormais celui validé par l'enseignant, et le
    // marqueur d'arbitrage disparaît : D5 n'est plus une lecture provisoire.
    statut = 'partielle';
    signatureErreur = signatureReconnue ?? SIGNATURE_PAR_DEFAUT;
    explication =
      signatureReconnue === null
        ? 'La valeur est exacte, mais la réponse n\'est pas écrite dans la forme demandée.'
        : explicationFausse(exercice, signatureErreur);
  } else if (achevement === 'inacheve') {
    // ---- CAS B (décision D5) ---------------------------------------------
    // Étape correcte mais inachevée : l'élève est sur la bonne voie.
    statut = 'partielle';
    signatureErreur = signatureReconnue ?? SIGNATURE_PAR_DEFAUT;
    explication =
      'Tu as bien décomposé le nombre sous la racine. Il reste à extraire le carré parfait pour terminer la simplification.';
  } else {
    // ---- CAS D --------------------------------------------------------------
    statut = 'correcte';
    signatureErreur = SIGNATURE_PAR_DEFAUT;
    explication = 'La valeur et la forme sont conformes.';
  }

  // --- Verdict pédagogique (décision D5) ----------------------------------
  const verdict = deriverVerdict(
    juste,
    exercice.regleForme !== null,
    formeRespectee,
    achevement,
  );
  const libelle = messagePourVerdict(verdict, exercice);

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
    achevement,
    statut,
    verdict,
    libelle,
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