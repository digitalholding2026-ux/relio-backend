/**
 * Les douze exercices originaux du MVP — 3 blocs, 5 objectifs, ≥ 3 items par
 * objectif.
 *
 * Règles de rédaction tenues dans ce fichier :
 *
 * - **aucun énoncé n'est repris d'une épreuve** : les énoncés sont écrits pour
 *   ce MVP, et `sourceBepc` vaut `null` sur les douze ;
 * - **la règle de forme est toujours énoncée dans la consigne** — on ne peut
 *   pas exiger une forme que l'élève ne voit pas ;
 * - **les pièges sont documentés et calculés**, pas devinés : chaque entrée de
 *   `pieges` est une réponse réellement produisible, associée à une signature
 *   du catalogue fermé ;
 * - **la réponse attendue est vérifiable** : `test/contenu.test.ts` recalcule
 *   chacune d'elles indépendamment de cette chaîne de caractères.
 */

import type { Exercice } from './types.js';

export const EXERCICES: readonly Exercice[] = [
  // -------------------------------------------------------------------------
  // B1 — Calcul littéral (OO-L1-1,OO-L1-2) — ouvert à S1
  // -------------------------------------------------------------------------
  {
    id: 'MVP-B1-E1',
    blocId: 'B1',
    rang: 1,
    objectifs: ['OO-L1-1'],
    enonce: 'On considère le nombre A = 3(x + 2) − (x + 5).',
    consigne: 'Développe et réduis A. Écris le résultat réduit.',
    typeReponse: 'expression',
    reponseAttendue: '2x + 1',
    regleForme: null,
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'On distribue le 3 dans (x + 2), et le signe « − » dans (x + 5).' },
      { palier: 2, texte: '3(x + 2) donne 3x + 6. Pour (x + 5), le « − » change le signe des deux termes.' },
      { palier: 3, texte: 'A = 3x + 6 − x − 5. Il ne reste plus qu\'à regrouper.' },
    ],
    pieges: [
      { reponse: '4x + 1', signature: 'signe_non_distribue', commentaire: 'Le « − » n\'a pas été distribué sur x.' },
      { reponse: '2x + 11', signature: 'signe_non_distribue', commentaire: 'Le « − » a été appliqué au terme constant seul.' },
      { reponse: '2x + 1 + x', signature: 'termes_non_collectes', commentaire: 'Les termes en x ne sont pas regroupés.' },
      { reponse: '2x', signature: 'termes_non_collectes', commentaire: 'Terme constant oublié.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B1-E2',
    blocId: 'B1',
    rang: 2,
    objectifs: ['OO-L1-1'],
    enonce: 'On considère le nombre B = (2x − 1)².',
    consigne: 'Développe et réduis B.',
    typeReponse: 'expression',
    reponseAttendue: '4x^2 - 4x + 1',
    regleForme: null,
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Un carré : on peut utiliser l\'identité remarquable (a − b)² = a² − 2ab + b².' },
      { palier: 2, texte: 'Ici a = 2x et b = 1. Attention : − 2ab donne − 4x.' },
      { palier: 3, texte: 'B = (2x)² − 2 × (2x) × 1 + 1².' },
    ],
    pieges: [
      { reponse: '4x^2 + 4x + 1', signature: 'signe_non_distribue', commentaire: 'Signe du terme central faux.' },
      { reponse: '2x^2 - 2x + 1', signature: 'hors_perimetre', commentaire: 'Seul x a été mis au carré.' },
      { reponse: '4x^2 - 4x', signature: 'termes_non_collectes', commentaire: 'Terme constant oublié.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B1-E3',
    blocId: 'B1',
    rang: 3,
    objectifs: ['OO-L1-1'],
    enonce: 'On considère le nombre C = (x + 3)(x − 2) − 2(x − 1).',
    consigne: 'Développe et réduis C.',
    typeReponse: 'expression',
    reponseAttendue: 'x^2 - x - 4',
    regleForme: null,
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Traite les deux produits séparément, avant de les soustraire.' },
      { palier: 2, texte: '(x + 3)(x − 2) : quatre termes. Et 2(x − 1) se distribue en 2x − 2.' },
      { palier: 3, texte: 'Le premier produit donne x² + x − 6. On soustrait ensuite 2x − 2.' },
    ],
    pieges: [
      { reponse: 'x^2 + x - 4', signature: 'hors_perimetre', commentaire: 'Le terme + 3x a été oublié dans le premier produit.' },
      { reponse: 'x^2 + 3x - 4', signature: 'signe_non_distribue', commentaire: 'Erreur de signe sur le terme en x.' },
      { reponse: 'x^2 - x - 8', signature: 'signe_non_distribue', commentaire: 'La parenthèse a été soustraite comme (2x + 2) au lieu de (2x − 2).' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B1-E4',
    blocId: 'B1',
    rang: 1,
    objectifs: ['OO-L1-2'],
    enonce: 'On considère le nombre D = 4x² − 9.',
    consigne: 'Factorise D sous la forme d’un produit de facteurs du premier degré.',
    typeReponse: 'expression',
    reponseAttendue: '(2x-3)(2x+3)',
    regleForme: 'produit_de_facteurs',
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: '4x² − 9 est une différence de deux carrés : a² − b².' },
      { palier: 2, texte: 'Ici a = 2x et b = 3. On utilise a² − b² = (a − b)(a + b).' },
      { palier: 3, texte: 'D = (2x)² − 3² = (2x − 3)(2x + 3).' },
    ],
    pieges: [
      { reponse: '(2x-4)(2x+4)', signature: 'signe_inverse_dans_difference_carre', commentaire: 'Le carré de 3 a été pris pour 4.' },
      { reponse: '(2x-3)^2', signature: 'hors_perimetre', commentaire: 'Différence de carrés transformée en carré.' },
      { reponse: '4x^2 - 9', signature: 'non_factorise', commentaire: 'Réponse laissée sous forme développée : juste, mais pas factorisée.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B1-E5',
    blocId: 'B1',
    rang: 2,
    objectifs: ['OO-L1-2'],
    enonce: 'On considère le nombre E = x² − 7x.',
    consigne: 'Factorise E sous la forme d’un produit de facteurs du premier degré.',
    typeReponse: 'expression',
    reponseAttendue: 'x(x-7)',
    regleForme: 'produit_de_facteurs',
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Cherche un facteur commun aux deux termes.' },
      { palier: 2, texte: 'x est présent dans x² et dans 7x. On peut donc le factoriser.' },
      { palier: 3, texte: 'x² − 7x = x² − x × 7. On sort x.' },
    ],
    pieges: [
      { reponse: 'x(x+7)', signature: 'signe_non_distribue', commentaire: 'Signe faux sur le second facteur.' },
      { reponse: 'x^2-7x', signature: 'non_factorise', commentaire: 'Aucune factorisation effectuée.' },
      { reponse: '7x(x-1)', signature: 'hors_perimetre', commentaire: 'Le facteur commun est x, pas 7x.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B1-E6',
    blocId: 'B1',
    rang: 3,
    objectifs: ['OO-L1-2'],
    enonce: 'On considère le nombre F = 3x² + 5x − 2.',
    consigne: 'Factorise F sous la forme d’un produit de facteurs du premier degré.',
    typeReponse: 'expression',
    reponseAttendue: '(3x-1)(x+2)',
    regleForme: 'produit_de_facteurs',
    // ⚠️ Aucune identité remarquable ne s'applique : la factorisation se
    // trouve « à la main ». L'ensemble des écritures acceptables comme
    // « produit de facteurs du premier degré » n'a pas été arbitré au-delà du
    // cas général ; le moteur accepte tout produit de facteurs de degré ≥ 1.
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Cherche deux nombres dont le produit vaut − 2 et dont la somme vaut 5.' },
      { palier: 2, texte: 'Ce sont 2 et − 1. Réécris alors F en (3x + ?)(x + ?).' },
      { palier: 3, texte: 'Avec 3 × 2 + 1 × (− 1) = 5 et 1 × (− 1) = − 2 : (3x − 1)(x + 2).' },
    ],
    pieges: [
      { reponse: '(3x+1)(x-2)', signature: 'signe_non_distribue', commentaire: 'Les deux signes sont inversés : le terme constant devient + 2.' },
      { reponse: '(x+1)(3x-2)', signature: 'hors_perimetre', commentaire: 'Produit = 3x² + x − 2, pas F.' },
      { reponse: '3x^2+5x-2', signature: 'non_factorise', commentaire: 'Forme développée : juste, mais pas factorisée.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },

  // -------------------------------------------------------------------------
  // B2 — Racines carrées (OO-L3-1) — ouvert à S5
  // -------------------------------------------------------------------------
  {
    id: 'MVP-B2-E1',
    blocId: 'B2',
    rang: 1,
    objectifs: ['OO-L3-1'],
    enonce: 'On considère le nombre G = √50.',
    consigne: 'Simplifie G sous la forme a√b, avec a entier et b sans facteur carré.',
    typeReponse: 'racine',
    reponseAttendue: '5√2',
    regleForme: 'racine_a_sqrt_b',
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Cherche le plus grand carré parfait qui divise le nombre sous la racine.' },
      { palier: 2, texte: '50 = 25 × 2, et 25 = 5².' },
      { palier: 3, texte: 'Écris 50 sous la forme d\'un carré parfait fois un nombre sans facteur carré : 50 = … × ….' },
    ],
    pieges: [
      { reponse: '25√2', signature: 'hors_perimetre', commentaire: '√25 = 5, pas 25.' },
      { reponse: '√5', signature: 'base_racine_erronee', commentaire: '50 n\'est pas 5 × 10.' },
      { reponse: '50√2', signature: 'carre_parfait_non_extrait', commentaire: 'Aucun carré parfait extrait.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B2-E2',
    blocId: 'B2',
    rang: 2,
    objectifs: ['OO-L3-1'],
    enonce: 'On considère le nombre H = 3√12 − √27.',
    consigne: 'Simplifie H sous la forme a√b, avec a entier et b sans facteur carré.',
    typeReponse: 'racine',
    reponseAttendue: '3√3',
    regleForme: 'racine_a_sqrt_b',
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Simplifie chaque racine séparément avant d\'additionner.' },
      { palier: 2, texte: '12 = 4 × 3 et 27 = 9 × 3 : les deux racines contiennent 3.' },
      { palier: 3, texte: 'Écris 12 et 27 sous la forme d\'un carré parfait fois un nombre : 12 = … , 27 = … .' },
    ],
    pieges: [
      { reponse: '6√3', signature: 'hors_perimetre', commentaire: 'Le terme − √27 a été oublié.' },
      { reponse: '-√3', signature: 'coefficient_multiplicatif_oublie', commentaire: 'Le coefficient 3 devant √12 a été oublié.' },
      { reponse: '3√27', signature: 'base_racine_erronee', commentaire: '√27 n\'a pas été ramenée à la même base que √12.' },
      { reponse: '6√12', signature: 'hors_perimetre', commentaire: 'Les deux racines ont été simplifiées séparément, puis ajoutées.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B2-E3',
    blocId: 'B2',
    rang: 3,
    objectifs: ['OO-L3-1'],
    enonce: 'On considère le nombre I = √8 + √18 − √32.',
    consigne: 'Simplifie I sous la forme a√b, avec a entier et b sans facteur carré.',
    typeReponse: 'racine',
    reponseAttendue: '√2',
    regleForme: 'racine_a_sqrt_b',
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Les trois nombres contiennent le même facteur carré : 8, 18 et 32.' },
      { palier: 2, texte: 'Décompose chacun des trois nombres en un carré parfait fois un entier.' },
      { palier: 3, texte: 'Une fois chaque racine ramenée à la même base, il ne reste qu\'à additionner les coefficients.' },
    ],
pieges: [
      { reponse: '3√2', signature: 'hors_perimetre', commentaire: 'Le terme − √32 a été oublié.' },
      { reponse: '6√2', signature: 'carre_parfait_non_extrait', commentaire: '√32 n\'a pas été ramenée à 4√2.' },
      { reponse: '5√2', signature: 'hors_perimetre', commentaire: '√32 a été ajouté au lieu d\'être soustrait : le signe s\'est perdu sur une racine, mécanisme différent du signe sur une fraction.' },
      { reponse: '9√2', signature: 'hors_perimetre', commentaire: 'Erreur de calcul : 2 + 3 + 4 = 9.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },

  // -------------------------------------------------------------------------
  // B3 — Calcul numérique (OO-L5-1, OO-L5-2) — ouvert à S10
  // Chaque exercice travaille conjointement le calcul et la mise en forme.
  // -------------------------------------------------------------------------
  {
    id: 'MVP-B3-E1',
    blocId: 'B3',
    rang: 1,
    objectifs: ['OO-L5-1', 'OO-L5-2'],
    enonce: 'On considère le nombre J = 7/8 − 3/4.',
    consigne: 'Calcule J et donne le résultat sous forme de fraction irréductible.',
    typeReponse: 'rationnelle',
    reponseAttendue: '1/8',
    regleForme: 'fraction_irreductible',
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Pour soustraire deux fractions, il faut des dénominateurs égaux.' },
      { palier: 2, texte: '8 est un multiple de 4 : 3/4 = 6/8.' },
      { palier: 3, texte: 'J = 7/8 − 6/8.' },
    ],
    pieges: [
      { reponse: '4/8', signature: 'denominateur_non_reduit', commentaire: '7 − 6 = 1, pas 4.' },
      { reponse: '7/4', signature: 'signe_non_reparti', commentaire: 'Le « − » a disparu.' },
      { reponse: '10/8', signature: 'denominateur_non_reduit', commentaire: 'Les fractions ont été ajoutées.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B3-E2',
    blocId: 'B3',
    rang: 2,
    objectifs: ['OO-L5-1', 'OO-L5-2'],
    enonce: 'On considère le nombre K = 5/6 + 7/9.',
    consigne: 'Calcule K et donne le résultat sous forme de fraction irréductible.',
    typeReponse: 'rationnelle',
    reponseAttendue: '29/18',
    regleForme: 'fraction_irreductible',
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Cherche un multiple commun à 6 et 9.' },
      { palier: 2, texte: 'Le PPCM de 6 et 9 est 18.' },
      { palier: 3, texte: '5/6 = 15/18 et 7/9 = 14/18.' },
    ],
    pieges: [
      { reponse: '12/15', signature: 'denominateur_non_reduit', commentaire: 'Dénominateur 15 = 6 + 9 : ce n\'est pas un multiple.' },
      { reponse: '29/15', signature: 'hors_perimetre', commentaire: 'Bon numérateur, mauvais dénominateur.' },
      { reponse: '12/18', signature: 'hors_perimetre', commentaire: 'Numérateurs non convertis.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
  {
    id: 'MVP-B3-E3',
    blocId: 'B3',
    rang: 3,
    objectifs: ['OO-L5-1', 'OO-L5-2'],
    enonce: 'On considère le nombre L = (3/4) × (8/9).',
    consigne: 'Calcule L et donne le résultat sous forme de fraction irréductible.',
    typeReponse: 'rationnelle',
    reponseAttendue: '2/3',
    regleForme: 'fraction_irreductible',
    regleFormeArbitree: true,
    indices: [
      { palier: 1, texte: 'Pour multiplier deux fractions, on multiplie les numérateurs entre eux, et les dénominateurs entre eux.' },
      { palier: 2, texte: 'Numérateur : 3 × 8. Dénominateur : 4 × 9.' },
      { palier: 3, texte: 'L = 24/36. Le numérateur et le dénominateur ont un facteur commun.' },
    ],
    pieges: [
      { reponse: '24/36', signature: 'denominateur_non_reduit', commentaire: 'Produit juste, mais non réduit.' },
      { reponse: '11/13', signature: 'hors_perimetre', commentaire: 'Numérateur et dénominateur additionnés.' },
      { reponse: '3/9', signature: 'hors_perimetre', commentaire: 'Seul le dénominateur a été multiplié.' },
      { reponse: '3/4', signature: 'hors_perimetre', commentaire: 'Le facteur 8/9 a été oublié sur une fraction ; la signature « coefficient multiplicatif oublié » désigne le coefficient d\'une racine, pas celui d\'un produit de fractions.' },
    ],
    origine: 'originale',
    sourceBepc: null,
  },
] as const;

export function trouverExercice(id: string): Exercice | undefined {
  return EXERCICES.find((exercice) => exercice.id === id);
}

export function exercicesDuBloc(blocId: string): Exercice[] {
  return EXERCICES.filter((exercice) => exercice.blocId === blocId);
}