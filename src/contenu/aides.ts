/**
 * Aides par objectif opérationnel — messages destinés à l'élève.
 *
 * ## Pourquoi ce fichier existe
 *
 * Le moteur Recognait une erreur mais ne sait pas toujours **expliquer le
 * travail à faire**. Jusqu'ici, le filet de sécurité était :
 *
 *     « Reprends la méthode de OO-L1-2 sur un exemple plus simple. »
 *
 * `OO-L1-2` est un identifiant technique. Le montrer à un élève est
 * inacceptable : ce n'est ni une explication, ni une action.
 *
 * Ce fichier remplace ce filet par une aide **concrète**, une par objectif du
 * MVP, rédigée pour un élève de 3e.
 *
 * ## Règles de rédaction tenues ici
 *
 * 1. **Aucun identifiant technique** dans un texte élève. Les identifiants
 *    servent de clé de correspondance ici, jamais d'explication.
 * 2. **Une action mathématique nommée** : développer, réduire, factoriser,
 *    simplifier, calculer. Jamais « objectif », « compétence », « méthode »
 *    sans dire laquelle.
 * 3. **Un exemple simple et résolu**, choisi hors du périmètre de tous
 *    l'exercice en cours : donner la réponse de l'exercice serait résoudre
 *    l'exercice à la place de l'élève.
 * 4. **Une invitation à retry** : le message doit dire quoi faire ensuite.
 * 5. **Aucune cause inventée** : ces aides ne prétendent pas savoir *pourquoi*
 *    l'élève s'est trompé. Elles disent quoi faire, ce qui est vrai même quand
 *    la cause exacte est inconnue.
 * 6. **Pas de réponse de l'exercice.** L'exempleResolverA est toujours un
 *    autre calcul que celui demandé.
 *
 * Les exemples sont vérifiés par `test/aides.test.ts`, qui recalcule chaque
 * égalité annoncée avec le moteur de production : une aide qui contiendrait
 * une faute de calcul serait refusée par la CI.
 */

import type { SignatureErreur } from './signatures.js';

/** Objectifs du MVP, réutilisés comme clés de correspondance. */
export type ObjectifId = 'OO-L1-1' | 'OO-L1-2' | 'OO-L3-1' | 'OO-L5-1' | 'OO-L5-2';

/**
 * Aide associée à un objectif.
 *
 * `exemple` est l'égalité résolue affichée à l'élève ; `suite` est l'invitation
 * à appliquer la même idée à son propre exercice.
 */
export interface AideObjectif {
  /** Ce que l'élève doit faire, en une phrase actionnable. */
  readonly action: string;
  /** Exemple simple, entièrement résolu, différent de l'exercice en cours. */
  readonly exemple: string;
  /** Ce qu'il doit tenter maintenant. */
  readonly suite: string;
  /**
   * Question d'orientation — chantier 7.5.
   *
   * Elle sert de premier retour quand **aucune cause n'est reconnue** : le
   * message doit alors poser une question à laquelle l'élève peut répondre
   * seul, plutôt qu'affirmer une règle qu'il n'a pas encore identifiée comme
   * étant en cause.
   */
  readonly question: string;
}

/**
 * Les cinq objectifs du MVP, avec la méthode réellement enseignée dans le
 * référentiel annuel.
 *
 * ⚠️ Ces aides décrivent la **méthode du programme**, pas le diagnostic d'une
 * erreur particulière. C'est volontaire : le moteur ne sait pas toujours
 * *pourquoi* l'élève s'est trompé, mais il sait toujours de quelle leçon il
 * s'agit.
 */
export const AIDES_PAR_OBJECTIF: Readonly<Record<ObjectifId, AideObjectif>> = {
  'OO-L1-1': {
    action:
      'Pour développer, il faut distribuer chaque terme dans les parenthèses, puis regrouper les termes qui se ressemblent.',
    exemple:
      'Par exemple : 2(x + 3) = 2x + 6, car le 2 se multiplie avec le x et avec le 3. ' +
      'Et si un terme est soustrait, le « − » change le signe de chaque terme entre parenthèses : 3(x − 4) = 3x − 12.',
    suite:
      'Applique cette idée à ton exercice : distribue d’abord, puis regroupe les termes en x et les nombres.',
    question:
      'Regarde les deux termes de ton expression : qu’est-ce qui se passe quand le nombre devant la parenthèse se distribue dans chacun d’eux ?'
  },
  'OO-L1-2': {
    action:
      'Pour factoriser, il faut chercher un facteur commun aux deux termes, ou reconnaître une différence de deux carrés.',
    exemple:
      'Par exemple : dans 3x + 6, le nombre 3 divise les deux termes, donc 3x + 6 = 3(x + 2). ' +
      'Et 4x² − 9 s’écrit (2x)² − 3², donc 4x² − 9 = (2x − 3)(2x + 3).',
    suite:
      'Cherche d’abord un nombre ou une lettre qui divise tous les termes de ton expression.',
    question:
      'Regarde les deux termes de ton expression : quel nombre ou quelle expression pourrait diviser chacun des termes ?'
  },
  'OO-L3-1': {
    action:
      'Pour simplifier une racine, il faut trouver le plus grand carré parfait contenu sous la racine et l’extraire.',
    exemple:
      'Par exemple : 63 = 9 × 7, et 9 = 3². Donc √63 = √(3² × 7) = 3√7. ' +
      'De même, 147 = 49 × 3, et 49 = 7², donc √147 = 7√3.',
    suite:
      'Cherche le plus grand carré parfait qui divise le nombre sous la racine, puis simplifie toutes les racines de la même façon avant d’additionner.',
    question:
      'Regarde le nombre sous la racine : peut-il s’écrire comme un carré parfait multiplié par un autre nombre ?'
  },
  'OO-L5-1': {
    action:
      'Pour additionner ou soustraire des fractions, il faut d’abord les écrire avec le même dénominateur.',
    exemple:
      'Par exemple : pour 1/2 + 1/3, le dénominateur commun est 6, car 6 est le premier multiple de 2 et de 3. ' +
      'Donc 1/2 + 1/3 = 3/6 + 2/6 = 5/6.',
    suite:
      'Trouve le dénominateur commun de ton calcul, puis vérifie le signe de chaque terme avant d’additionner.',
    question:
      'Regarde les dénominateurs de ton calcul : par quel nombre peut-on les multiplier pour les rendre égaux ?'
  },
  'OO-L5-2': {
    action:
      'Pour écrire un résultat sous forme irréductible, il faut simplifier le numérateur et le dénominateur en les divisant par un même nombre.',
    exemple:
      'Par exemple : 6/8 se simplifie en divisant le 6 et le 8 par 2, ce qui donne 3/4. ' +
      'On continue tant que le numérateur et le dénominateur ont encore un facteur commun.',
    suite:
      'Divise les deux termes de ta fraction par le même nombre, le plus grand possible.',
    question:
      'Regarde le numérateur et le dénominateur de ta fraction : par quel nombre could-tu les diviser tous les deux ?'
  },
};

/**
 * Aide pour une signature d'erreur reconnue.
 *
 * Quand la signature est identifiée, le message parle de l'erreur précise :
 * c'est plus utile qu'une aide générale. Aucune n'expose d'identifiant.
 */
export const AIDES_PAR_SIGNATURE: Readonly<
  Partial<Record<SignatureErreur, string>>
> = {
  denominateur_non_reduit:
    'Ton calcul est juste, mais le résultat doit être simplifié. ' +
    'Divise le numérateur et le dénominateur par un même nombre, plusieurs fois si nécessaire.',
  signe_non_reparti:
    'Attention au signe : le signe appartient à son terme, pas à tout le calcul. ' +
    'Vérifie chaque terme séparément.',
  signe_non_distribue:
    'Quand tu distribues une parenthèse précédée du signe « − », ce signe change devant chaque terme. ' +
    'Par exemple : −(x + 3) = −x − 3.',
  termes_non_collectes:
    'Il reste des termes à regrouper : on additionne les coefficients qui accompagnent la même lettre. ' +
    'Par exemple : x + x + 3 = 2x + 3.',
  non_factorise:
    'Tu as obtenu la bonne valeur, mais il reste tout à factoriser. ' +
    'Cherche un facteur commun aux deux termes de ton expression.',
  signe_inverse_dans_difference_carre:
    'Dans la formule a² − b² = (a − b)(a + b), le premier facteur garde le signe « − » et le second le signe « + ». ' +
    'Par exemple : x² − 4 = (x − 2)(x + 2).',
  carre_parfait_non_extrait:
    'Un carré parfait se cache sous la racine : il faut l’extraire avant de continuer. ' +
    'Par exemple : √175 = √(25 × 7) = 5√7.',
  coefficient_multiplicatif_oublie:
    'Le nombre écrit devant la racine compte aussi : il faut le multiplier par la valeur extraite. ' +
    'Par exemple : 2√12 = 2 × 2√3 = 4√3.',
  base_racine_erronee:
    'Pour additionner des racines, il faut d’abord les ramener à la même base. ' +
    'Par exemple : √8 et √18 donnent toutes deux 2√2 et √3.',
  hors_perimetre:
    // Volontairement absent : c'est le cas « aucune cause identifiée ». Le
    // moteur ne doit alors pas inventer de diagnostic, et l'aide générale de
    // l'objectif est utilisée à la place.
    undefined,
};

/**
 * Orientations **courtes**, par signature — chantier 7.5.
 *
 * ## Pourquoi un second niveau de texte
 *
 * `AIDES_PAR_SIGNATURE` porte la règle *et* son exemple résolu. C'est le bon
 * contenu pour une explication de deuxième tour, mais c'est **trop long pour un
 * premier échec** : l'élève qui vient de se tromper reçoit d'emblée la méthode
 * complète et un exemple intégralement résolu, ce qui lui fait produire une
 * réponse apprise par cœur plutôt qu'une réponse comprise.
 *
 * Ces orientations font une phrase, posent une question et n'incluent **aucun
 * exemple résolu**. Elles servent de premier retour du tutorat.
 *
 * Règles tenues ici, identiques au reste du fichier :
 *
 * 1. aucun identifiant technique ;
 * 2. **une question orientée**, à laquelle l'élève peut répondre seul ;
 * 3. **aucun exemple résolu** — c'est ce que le niveau 2 apporte ;
 * 4. **aucune cause affirmée** quand la signature ne le permet pas.
 */
export const ORIENTATIONS_PAR_SIGNATURE: Readonly<
  Partial<Record<SignatureErreur, string>>
> = {
  denominateur_non_reduit:
    'Le résultat doit être simplifié avant d’être rendu. Regarde les deux termes de ta fraction : ont-ils encore un facteur commun ?',
  signe_non_reparti:
    'Le signe change selon le terme qu’il précède. Vérifie le signe de chaque terme séparément.',
  signe_non_distribue:
    'As-tu distribué le signe « − » dans chaque terme entre parenthèses ? Que devient un terme précédé du « − » ?',
  termes_non_collectes:
    'As-tu regroupé tous les termes qui portent la même lettre ? Il reste peut-être des termes à additionner.',
  non_factorise:
    'Regarde les deux termes de ton expression : existe-t-il un nombre ou une lettre qui divise les deux ?',
  signe_inverse_dans_difference_carre:
    'Dans les deux facteurs, quel est le signe du premier ? Le second doit-il porter le même signe ?',
  carre_parfait_non_extrait:
    'Le nombre sous la racine contient-il un carré parfait ? Essaie de le trouver avant de simplifier.',
  coefficient_multiplicatif_oublie:
    'Le nombre écrit devant la racine compte aussi : que se passe-t-il quand il est multiplié par ce que tu extrais ?',
  base_racine_erronee:
    'Tes racines portent-elles sur le même nombre sous le signe radical ? Simplifie chacune avant d’additionner.',
  hors_perimetre:
    // Volontairement absent : cause inconnue. Le tutorat retombe alors sur
    // l'orientation de l'objectif, sans inventer de diagnostic.
    undefined,
};

/**
 * Orientation courte pour un objectif, sans cause affirmée.
 *
 * Elle reprend `action` — phrase actionnable déjà rédigée — et y ajoute une
 * question. Elle n'utilise **ni** `exemple` **ni** `suite` : ce sont les
 * contenus des niveaux 2 et 3.
 */
export function orientationPourObjectif(objectifId: string): string {
  const correspondance = AIDES_PAR_OBJECTIF[objectifId as ObjectifId];
  if (!correspondance) {
    return (
      'Reprends l’exercice étape par étape : écris chaque transformation sur une ligne ' +
      'et vérifie le résultat avant de passer à la suivante.'
    );
  }
  return correspondance.action;
}

/**
 * Question d'orientation pour un objectif.
 *
 * Premier retour du tutorat quand aucune cause n'est reconnue. Elle est
 * volontairement **seule** : énoncer la règle *et* la question exceederait la
 * consigne de brièveté du premier échec, et l'élève n'aurait plus à chercher.
 */
export function questionPourObjectif(objectifId: string): string {
  const correspondance = AIDES_PAR_OBJECTIF[objectifId as ObjectifId];
  if (!correspondance) {
    return 'Peux-tu écrire chaque transformation de ton calcul sur une ligne séparée ?';
  }
  return correspondance.question;
}

/**
 * Message d'aide pour un exercice et une signature.
 *
 * @param objectifId objectif principal de l'exercice
 * @param signature signature reconnue, ou `null` si rien n'est reconnu
 */
export function aidePour(
  objectifId: string,
  signature: SignatureErreur | null,
): string {
  const aide = AIDES_PAR_SIGNATURE[signature as SignatureErreur];
  if (aide !== undefined) return aide;

  // Aucune cause reconnue : on donne la méthode de la leçon, sans prétendre
  // savoir pourquoi l'élève s'est trompé.
  const correspondance = AIDES_PAR_OBJECTIF[objectifId as ObjectifId];
  if (correspondance) {
    return `${correspondance.action} ${correspondance.exemple} ${correspondance.suite}`;
  }

  // Objectif inconnu — ne doit pas arriver dans le MVP, mais le filet reste
  // lisible par un élève plutôt que technique.
  return (
    'Reprends l’exercice étape par étape : écris chaque transformation sur une ligne ' +
    'et vérifie le résultat avant de passer à la suivante.'
  );
}