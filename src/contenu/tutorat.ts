/**
 * Tutorat pas à pas — chantier 7.5.
 *
 * ## Ce que le chantier 7.4 avait laissé en place
 *
 * Une réponse fausse suffisait à déclencher **un seul** message long : la règle,
 * un exemple entièrement résolu et une relance, le tout d'un bloc. L'élève
 * identifiait ainsi la méthode sans avoir lui-même cherché, et le nombre de
 * réponses justes augmentait sans que la compréhension soit démontrée.
 *
 * ## Ce que ce module fait à la place
 *
 * Une **échelle d'aides**, du plus prudent au plus direct, choisie à partir de
 * ce que le moteur sait réellement :
 *
 * | Niveau | Appellation | Ce qu'il apporte | Ce qu'il ne fait pas |
 * |---|---|---|---|
 * | 1 | Orienter | une question ciblée sur l'erreur reconnue | ne donne ni méthode complète ni exemple résolu |
 * | 2 | Expliquer une étape | la règle, puis une étape sur un **autre** exemple | ne travaille pas sur l'exercice de l'élève |
 * | 3 | Accompagner directement | la prochaine opération à effectuer sur **son** exercice | ne publie pas la réponse attendue |
 *
 * ## Choix d'architecture : pourquoi c'est déterministe
 *
 * L'échelle est une **fonction pure** de (exercice, verdict, nombre d'échecs
 * déjà essuyés). Aucune IA, aucun appel externe, aucun coût : le tutorat est
 * reproductible, testable, et il ne peut pas inventer une difficulté. Le
 * chantier 7.5 écarte explicitement le tuteur conversationnel.
 *
 * ## Réutilisation plutôt que duplication
 *
 * Le contenu des niveaux **n'est pas réécrit** :
 *
 * - niveau 1 → `ORIENTATIONS_PAR_SIGNATURE` ou `AIDES_PAR_OBJECTIF[].action` ;
 * - niveau 2 → l'**indice palier 2 de l'exercice** s'il existe, sinon
 *   `AIDES_PAR_OBJECTIF[].exemple` (donc un exemple différent de l'exercice) ;
 * - niveau 3 → l'**indice palier 3 de l'exercice** s'il existe, sinon
 *   `AIDES_PAR_OBJECTIF[].suite`.
 *
 * Les 36 indices existants restent donc la matière première du tutorat : ils
 * changent de moment d'affichage, ils ne sont pas doublés.
 *
 * ## Règle de vérité
 *
 * Le niveau n'escalade jamais « pour faire semblant ». Il dépend du nombre
 * d'échecs réellement observés et des indices réellement disponibles. Et
 * l'origine du texte est retournée (`origine`) : l'enseignant peut savoir si
 * l'élève a reçu une aide ciblée ou une aide générale.
 */

import {
  AIDES_PAR_OBJECTIF,
  ORIENTATIONS_PAR_SIGNATURE,
  orientationPourObjectif,
  questionPourObjectif,
  type ObjectifId,
} from './aides.js';
import { formeDansLeMessage, type CorrectionComplete } from './correction.js';
import { SIGNATURE_PAR_DEFAUT, type SignatureErreur } from './signatures.js';
import type { Exercice } from './types.js';

// ---------------------------------------------------------------------------
// Niveaux d'aide
// ---------------------------------------------------------------------------

/** Niveau d'aide — palier du tutorat, distinct des paliers d'indice. */
export type NiveauAide = 1 | 2 | 3;

/** D'où vient le texte affiché à l'élève. */
export type OrigineAide =
  /** La cause a été reconnue : le message ne parle que d'elle. */
  | 'signature'
  /** Le texte vient d'un des trois indices de l'exercice. */
  | 'indice'
  /** Aucune cause reconnue : le texte vient de la leçon de l'objectif. */
  | 'objectif'
  /** L'erreur porte sur la forme demandée, pas sur le calcul. */
  | 'forme'
  /** Bilan de fin de travail : la méthode est résumée. */
  | 'bilan'
  /** Aucune lecture possible : aide neutre, sans cause affirmée. */
  | 'generique';

/** Échelle d'aide rendue à l'élève. */
export interface Tutorat {
  readonly niveau: NiveauAide;
  /** Ce qu'il faut faire maintenant — une action, pas une leçon. */
  readonly message: string;
  readonly action: string;
  readonly origine: OrigineAide;
  /**
   * Résumé de la méthode, rendu **seulement** une fois le travail terminé ou
   * compris. C'est l'étape « résumer la méthode » du parcours.
   */
  readonly resume: string | null;
}

// ---------------------------------------------------------------------------
// Catégories de difficulté
// ---------------------------------------------------------------------------

/**
 * Catalogue **fermé** des difficultés que le moteur sait nommer.
 *
 * ## Deux valeurs distinctes à ne pas confondre
 *
 * - `null` — **aucune erreur** : la réponse a été jugée juste. Ce n'est pas
 *   une lacune de connaissance ;
 * - `erreur_non_identifiee` — une erreur **est** constatée, mais le moteur ne
 *   sait pas laquelle. C'est l'image inversée.
 *
 * Les confondre reviendrait à afficher « difficulté inconnue » à un élève qui
 * a réussi, ce qui nuirait au suivi qu'on cherche justement à fiabiliser.
 *
 * ## Deux catégories du cahier des charges ne sont pas émises
 *
 * `denominateur_commun_incorrect` et `factorisation_incomplete` figuraient
 * dans la liste du chantier. **Aucune signature du MVP ne les reconnaît** : les
 * émettre reviendrait à attribuer un diagnostic que le moteur n'a pas observé,
 * exactement ce que le chantier interdit. Elles sont donc absentes du
 * catalogue, et `erreur_non_identifiee` prend leur place tant qu'aucun piège
 * documenté ne les prouve.
 */
export const CATEGORIES_DIFICULTE = [
  'oubli_de_distribuer_un_facteur',
  'erreur_de_signe',
  'reduction_incomplete',
  'facteur_commun_non_identifie',
  'simplification_de_racine_incomplete',
  'fraction_non_reduite',
  'reponse_illisible',
  'erreur_non_identifiee',
] as const;

export type CategorieDifficulte = (typeof CATEGORIES_DIFICULTE)[number];

/** Contrôle d'appartenance au vocabulaire fermé. */
export function estCategorieDifficulte(valeur: string): valeur is CategorieDifficulte {
  return (CATEGORIES_DIFICULTE as readonly string[]).includes(valeur);
}

/**
 * Catégorie correspondant à une signature reconnue.
 *
 * La correspondance est **explicite et totale** : aucune signature ne se
 * retrouve sans catégorie, ce qui empêche d'émettre une difficulté à moitié
 * preenchie.
 *
 * `hors_perimetre` — le cas « cause inconnue » — donne
 * `erreur_non_identifiee`, **jamais** une cause plausible. C'est la garantie
 * centrale du suivi : une difficulté non observée n'est pas enregistrée comme
 * une difficulté observée.
 */
const CATEGORIE_PAR_SIGNATURE: Readonly<Record<SignatureErreur, CategorieDifficulte>> = {
  signe_non_reparti: 'erreur_de_signe',
  signe_perdu_en_resolution: 'erreur_de_signe',
  signe_inverse_dans_difference_carre: 'erreur_de_signe',
  signe_non_distribue: 'oubli_de_distribuer_un_facteur',
  coefficient_multiplicatif_oublie: 'oubli_de_distribuer_un_facteur',
  termes_non_collectes: 'reduction_incomplete',
  resolution_incompletee: 'reduction_incomplete',
  non_factorise: 'facteur_commun_non_identifie',
  carre_parfait_non_extrait: 'simplification_de_racine_incomplete',
  base_racine_erronee: 'simplification_de_racine_incomplete',
  denominateur_non_reduit: 'fraction_non_reduite',
  hors_perimetre: 'erreur_non_identifiee',
};

/**
 * Catégorie d'une correction.
 *
 * `null` dès que le verdict est un succès mathématique : il n'y a alors
 * aucune erreur à nommer.
 */
export function categoriePour(correction: CorrectionComplete): CategorieDifficulte | null {
  if (correction.mathemathiquementJuste) return null;
  const signature = correction.signatureErreur ?? SIGNATURE_PAR_DEFAUT;
  return CATEGORIE_PAR_SIGNATURE[signature] ?? 'erreur_non_identifiee';
}

/** Catégorie d'une signature isolée — utilisée par le suivi des observations. */
export function categoriePourSignature(signature: string): CategorieDifficulte {
  if (signature in CATEGORIE_PAR_SIGNATURE) {
    return CATEGORIE_PAR_SIGNATURE[signature as SignatureErreur];
  }
  return 'erreur_non_identifiee';
}

// ---------------------------------------------------------------------------
// Escalade
// ---------------------------------------------------------------------------

/**
 * Nombre d'échecs acceptés comme contexte.
 *
 * Borné à 20 : au-delà, l'élève est dans le même échec et le niveau 3 est
 * depuis longtemps atteint. La borne empêche aussi qu'un client n'envoie un
 * nombre arbitrairement grand pour forcer un niveau.
 */
export const NB_ECHECS_MAX = 20;

/** Niveau déduit du nombre d'échecs déjà essuyés sur cet exercice. */
export function niveauPourNbEchecs(nbEchecs: number): NiveauAide {
  if (nbEchecs <= 0) return 1;
  if (nbEchecs === 1) return 2;
  return 3;
}

/** Normalise une valeur reçue du client : entière, positive, bornée. */
export function normaliserNbEchecs(valeur: unknown): number {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return 0;
  const entier = Math.trunc(valeur);
  if (entier <= 0) return 0;
  return Math.min(entier, NB_ECHECS_MAX);
}

// ---------------------------------------------------------------------------
// Bilan de méthode
// ---------------------------------------------------------------------------

/**
 * Résumé de la méthode de la leçon.
 *
 * `AIDES_PAR_OBJECTIF[].action` décrit la méthode en une phrase actionnable ;
 * c'est exactement la fonction d'un bilan, et elle servait jusqu'ici
 * concaténée au début d'un message d'échec. Elle est ici employée pour ce
 * qu'elle est.
 */
function resumePourObjectif(objectifId: string): string {
  return orientationPourObjectif(objectifId);
}

// ---------------------------------------------------------------------------
// Échelle — branche « résultat juste, forme non respectée »
// ---------------------------------------------------------------------------

/**
 * Ce qu'il reste à faire quand le calcul est juste.
 *
 * Distingue deux situations que l'élève vit très différemment : il doit
 * **réécrire** (la valeur est bonne) ou il doit **terminer** (une étape
 * d'achèvement manque). Les traiter de la même chose produirait le même
 * message pour deux problèmes opposés.
 */
function resteAFaire(correction: CorrectionComplete): 'forme' | 'achevement' | null {
  // ⚠️ Garde indispensable : `formeRespectee === false` n'implique **pas** que
  // la valeur soit juste. Un élève peut rendre une expression fausse ET mal
  // formée (sur `MVP-B1-E5`, `2x − 7` vaut bien un produit de facteurs, mais
  // pas la valeur attendue). Sans cette garde, le tutorat dirait « ton résultat
  // est juste » sur une réponse fausse — l'erreur inverse de celle qu'il combat.
  if (!correction.mathemathiquementJuste) return null;
  if (correction.achevement === 'inacheve') return 'achevement';
  if (correction.formeRespectee === false) return 'forme';
  return null;
}

/**
 * Squelette d'écriture de la forme demandée — niveau 3 de la branche « forme ».
 *
 * Il décrit **la syntaxe**, jamais la valeur : donner le résultat sous forme de
 * gabarit ne livre pas la réponse, alors qu'un exemple chiffré le ferait.
 */
function squeletteDeForme(exercice: Exercice): string {
  switch (exercice.regleForme) {
    case 'fraction_irreductible':
      return 'Écris d’abord le numérateur, puis le dénominateur, séparés par la barre de fraction, et simplifie avant.';
    case 'produit_de_facteurs':
      return 'Écris chaque facteur entre parenthèses, puis les multiplie un par un entre les parenthèses.';
    case 'racine_a_sqrt_b':
      return 'Écris le coefficient, puis le symbole racine, puis le nombre resté sous la racine.';
    default:
      return 'Réécris ta réponse en respectant la forme demandée par la consigne.';
  }
}

/** Aide pour un résultat juste dont la forme n'est pas respectée. */
function tutoratForme(
  exercice: Exercice,
  correction: CorrectionComplete,
  niveau: NiveauAide,
): Tutorat {
  const forme = formeDansLeMessage(exercice);
  const reste = resteAFaire(correction);
  const objectifId = exercice.objectifs[0] ?? '';
  const squelette = squeletteDeForme(exercice);
  const correspondance = AIDES_PAR_OBJECTIF[objectifId as ObjectifId];

  // --- Cas B : une étape d'achèvement manque -------------------------------
  if (reste === 'achevement') {
    // L'élève est **sur la bonne voie** : la décomposition est juste, c'est
    // l'extraction qui manque. Le nommer est la reconnaissance la plus utile
    // qui soit, et c'est ce que le chantier 7.3 avait décidé.
    if (niveau === 1) {
      return {
        niveau: 1,
        message:
          'Tu as bien décomposé le nombre sous la racine. Il reste à en extraire le carré parfait.',
        action: 'Cherche quel carré parfait se cache dans le nombre sous la racine.',
        origine: 'signature',
        resume: null,
      };
    }

    if (niveau === 2) {
      return {
        niveau: 2,
        // La règle, puis un exemple sur un **autre** nombre : jamais celui de
        // l'exercice en cours.
        message: `Un carré parfait se cache sous la racine : il faut l’extraire avant de continuer. ${correspondance?.exemple ?? ''}`.trim(),
        action: 'Reprends cette décomposition sur ton propre nombre.',
        origine: 'objectif',
        resume: null,
      };
    }

    const indice = indiceDuPalier(exercice, 3);
    return {
      niveau: 3,
      message: indice ?? 'Trouve le plus grand carré parfait qui divise le nombre sous ta racine.',
      action: 'Effectue cette décomposition, puis simplifie complètement la racine.',
      origine: indice === null ? 'objectif' : 'indice',
      resume: null,
    };
  }

  // --- Cas A : valeur juste, forme non respectée ----------------------------
  switch (niveau) {
    case 1:
      return {
        niveau: 1,
        message:
          forme === null
            ? 'Ton résultat est juste, mais ce n’est pas la forme demandée par la consigne.'
            : `Ton résultat est juste, mais ce n’est pas la forme demandée : il faut l’écrire sous la forme ${forme}.`,
        action: 'Réécris ta réponse avec cette forme.',
        origine: 'forme',
        resume: null,
      };
    case 2:
      return {
        niveau: 2,
        message: `La valeur est juste, l’écriture ne l’est pas. ${squelette}`,
        action: 'Réécris maintenant ta réponse en respectant cette forme.',
        origine: 'forme',
        resume: null,
      };
    default:
      return {
        niveau: 3,
        // Dernier niveau : la syntaxe **et** un exemple entièrement travaillé,
        // sur une autre expression. L'élève sait alors écrire la forme ; il ne
        // reste qu'à y verser son propre résultat.
        message: `${squelette} ${correspondance?.exemple ?? ''}`.trim(),
        action: 'Réécris ta réponse en respectant cette forme.',
        origine: 'forme',
        resume: null,
      };
  }
}

// ---------------------------------------------------------------------------
// Échelle — branche « résultat faux »
// ---------------------------------------------------------------------------

/** Indice d'un palier donné, ou `null` si l'exercice n'a pas ce palier. */
function indiceDuPalier(exercice: Exercice, palier: 1 | 2 | 3): string | null {
  return exercice.indices.find((i) => i.palier === palier)?.texte ?? null;
}

/** Aide générale de la leçon, sans aucune cause affirmée. */
function aideGenerique(exercice: Exercice): string {
  return orientationPourObjectif(exercice.objectifs[0] ?? '');
}

/**
 * Échelle d'aide pour une réponse mathématiquement fausse.
 *
 * La progression est **réelle**, pas cosmétique :
 *
 * - **niveau 1** — une question sur l'erreur *reconnue*. Sans cause reconnue,
 *   on bascule sur la méthode de la leçon, sans prétendre savoir ce qui a
 *   échoué ;
 * - **niveau 2** — une étape sur un **autre** exemple. L'indice de l'exercice
 *   est préféré quand il existe : il a précisément été écrit pour cela ;
 * - **niveau 3** — la prochaine opération **sur son exercice**. C'est le seul
 *   niveau qui travaille sur les données de l'élève.
 *
 * À chaque niveau, la cause reconnue reste nommée quand elle existe : c'est
 * elle qui oriente le message, pas le niveau.
 */
function tutoratIncorrect(
  exercice: Exercice,
  signature: SignatureErreur,
  niveau: NiveauAide,
): Tutorat {
  const objectifId = exercice.objectifs[0] ?? '';
  const correspondance = AIDES_PAR_OBJECTIF[objectifId as ObjectifId];
  const causeConnue = signature !== SIGNATURE_PAR_DEFAUT;

  // Niveau 1 — orientation courte.
  if (niveau === 1) {
    const orientation = causeConnue ? ORIENTATIONS_PAR_SIGNATURE[signature] : undefined;
    if (orientation !== undefined) {
      return {
        niveau: 1,
        message: orientation,
        action: 'Réessaie en tenant compte de cette question.',
        origine: 'signature',
        resume: null,
      };
    }
    return {
      niveau: 1,
      // Aucune cause reconnue : on ne prétend pas savoir ce qui a échoué. On
      // donne la méthode de la leçon **et** une question à laquelle l'élève peut
      // répondre seul — c'est ce qui le fait chercher, plutôt que lire.
      // La question **seule** : énoncer aussi la règle ferait du premier
      // retour un mini-cours, ce que le chantier refuse explicitement.
      message: questionPourObjectif(objectifId),
      action: 'Réessaie en tenant compte de cette question.',
      origine: 'objectif',
      resume: null,
    };
  }

  // Niveau 2 — la règle, puis une étape sur un autre exemple.
  if (niveau === 2) {
    const indice = indiceDuPalier(exercice, 2);
    if (indice !== null) {
      return {
        niveau: 2,
        message: causeConnue
          ? `${aideGenerique(exercice)} ${indice}`
          : indice,
        action: 'Applique cette étape à ton exercice, puis vérifie ton résultat.',
        origine: 'indice',
        resume: null,
      };
    }

    const exemple = correspondance?.exemple;
    if (exemple !== undefined) {
      return {
        niveau: 2,
        // `exemple` est par construction différent de l'exercice en cours :
        // `test/tutorat.test.ts` le revérifie pour les douze exercices.
        message: `${aideGenerique(exercice)} ${exemple}`,
        action: 'Reprends la même idée sur ton propre exercice.',
        origine: 'objectif',
        resume: null,
      };
    }

    return {
      niveau: 2,
      message: aideGenerique(exercice),
      action: 'Réessaie en tenant compte de cette question.',
      origine: 'objectif',
      resume: null,
    };
  }

  // Niveau 3 — la prochaine opération, sur son exercice.
  const indiceDirect = indiceDuPalier(exercice, 3);
  const suite = correspondance?.suite;

  if (indiceDirect !== null) {
    return {
      niveau: 3,
      message: indiceDirect,
      action: 'Effectue cette dernière transformation, puis vérifie ta réponse.',
      origine: 'indice',
      resume: null,
    };
  }

  if (suite !== undefined) {
    return {
      niveau: 3,
      message: `${aideGenerique(exercice)} ${suite}`,
      action: 'Effectue cette dernière transformation, puis vérifie ta réponse.',
      origine: 'objectif',
      resume: null,
    };
  }

  return {
    niveau: 3,
    message: aideGenerique(exercice),
    action: 'Reprends l’exercice ligne par ligne, une transformation à la fois.',
    origine: 'objectif',
    resume: null,
  };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/**
 * Construit l'aide à afficher après une correction.
 *
 * La fonction ne modifie **jamais** le verdict : elle ne fait que choisir le
 * texte d accompaniment. Un `verdict` de `correct` reste un succès.
 *
 * @param exercice exercice corrigé
 * @param correction résultat de `corriger()`
 * @param nbEchecs nombre d'échecs **déjà essuyés** sur cet exercice. `0` = cet
 *        échec est le premier.
 */
export function construireTutorat(
  exercice: Exercice,
  correction: CorrectionComplete,
  nbEchecs: number,
): Tutorat {
  const niveau = niveauPourNbEchecs(nbEchecs);
  const objectifId = exercice.objectifs[0] ?? '';
  const signature = correction.signatureErreur ?? SIGNATURE_PAR_DEFAUT;

  // --- Succès ---------------------------------------------------------------
  if (correction.verdict === 'correct') {
    // Le travail est terminé : c'est le moment du bilan de méthode. Il est
    // rendu même sans aide reçue — c'est une méthode à retenir, pas une
    // récompense.
    return {
      niveau: 1,
      message:
        nbEchecs > 0
          ? `Tu y es arrivé après ${nbEchecs === 1 ? 'un essai' : `${nbEchecs} essais`}. Voici la méthode à retenir.`
          : 'Ta réponse est juste. Voici la méthode à retenir.',
      action: 'Lis la méthode ci-dessous avant de passer à la suite.',
      origine: 'bilan',
      resume: resumePourObjectif(objectifId),
    };
  }

  // --- Résultat juste, travail inachevé ou mal formé ------------------------
  if (resteAFaire(correction) !== null) {
    return tutoratForme(exercice, correction, niveau);
  }

  // --- Forme non arbitrable -------------------------------------------------
  // Le moteur ne peut pas conclure : il ne doit surtout pas inventer une
  // explication. On demande une nouvelle saisie et on donne une aide générale.
  if (correction.verdict === 'a_determiner') {
    return {
      niveau: 1,
      message:
        'Le moteur ne peut pas vérifier la forme demandée. Vérifie toi-même que tu as bien respecté la consigne d’écriture.',
      action: 'Réécris ta réponse, puis vérifie.',
      origine: 'generique',
      resume: null,
    };
  }

  // --- Résultat faux -------------------------------------------------------
  return tutoratIncorrect(exercice, signature, niveau);
}

/**
 * Aide pour une saisie **illisible**.
 *
 * Le moteur n'a rien à dire sur une expression qu'il n'a pas comprise : il ne
 * propose donc **aucune** cause. Il indique seulement comment Reformuler, ce
 * qui est vrai et toujours utile.
 *
 * La réponse est refusée avant toute correction, donc aucun verdict n'est
 * produit : il n'y a rien à analyser, et l'élève n'est pas « en erreur ».
 */
export function tutoratSaisieInvalide(exercice: Exercice): Tutorat {
  return {
    niveau: 1,
    message:
      'La réponse n’a pas pu être lue. Vérifie les symboles : le signe « − », la barre de fraction, ' +
      'le symbole racine et les parenthèses doivent être écrits normalement.',
    action: 'Réécris ta réponse, ou utilise le clavier mathématique.',
    origine: 'generique',
    resume: null,
  };
}