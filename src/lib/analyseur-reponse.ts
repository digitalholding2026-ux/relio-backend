/**
 * Analyse d'une réponse d'élève, par type de grandeur attendu.
 *
 * Chaque type produit un **objet valeur** distinct, jamais une chaîne. C'est ce
 * qui permet de traiter séparément :
 *
 * 1. la **justesse mathématique** — égalité exacte des objets valeur ;
 * 2. le **respect de la forme demandée** — propriété de l'écriture
 *    (`7/6` est irréductible, `14/12` ne l'est pas) ;
 * 3. l'**interprétation pédagogique** — conséquence du statut, hors de ce module.
 */

import {
  estEntier,
  estEgal,
  facteursPremiers,
  pgcdEntiers,
  rationnel,
  versChaine,
  type Rational,
} from './algebre.js';
import {
  analyserExpression,
  comparerPolynomes,
  ExpressionRefusee,
  type Noeud,
  type Polynome,
  versPolynomeVerifie,
} from './analyseur-expression.js';

/** Réponse illisible ou hors du modèle accepté. */
export class ReponseInvalide extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ReponseInvalide';
  }
}

// ---------------------------------------------------------------------------
// Valeurs
// ---------------------------------------------------------------------------

export type FormeEcriture = 'entiere' | 'fraction' | 'decimale';

/**
 * Grandeur rationnelle : un nombre relatif exact, et la façon dont il a été
 * écrit.
 *
 * `numerateurEcrit` et `denominateurEcrit` conservent le couple **tel que
 * l'élève l'a tapé**. Ils sont indispensables : la valeur est toujours
 * normalisée, donc `14/12` devient `7/6` et l'irréductibilité disparaîtrait si
 * on ne jugeait que la valeur. Or c'est bien l'écriture qui est en cause.
 */
export interface ValeurRationnelle {
  readonly type: 'rationnelle';
  readonly valeur: Rational;
  readonly forme: FormeEcriture;
  readonly numerateurEcrit: bigint;
  readonly denominateurEcrit: bigint;
}

/** Grandeur algébrique : un polynôme exact en `x`. */
export interface ValeurExpression {
  readonly type: 'expression';
  readonly noeud: Noeud;
  readonly polynome: Polynome;
}

/** Grandeur de la forme `a√b`, normalisée : `b` est toujours sans facteur carré. */
export interface ValeurRacine {
  readonly type: 'racine';
  readonly coefficient: Rational;
  readonly radicand: number;
  /** `b` avant extraction des carrés parfaits — sert au diagnostic d'erreur. */
  readonly radicandSaisi: number;
}

export type Valeur = ValeurRationnelle | ValeurExpression | ValeurRacine;

// ---------------------------------------------------------------------------
// Rationnels
// ---------------------------------------------------------------------------

/**
 * Analyse un nombre rationnel saisi.
 *
 * Accepte `7/6`, `-7/6`, `7`, `-7`, `+7`, `1,5` et `1.5`.
 * La **forme** est conservée : elle sert au jugement sur la forme demandée.
 */
export function analyserRationnel(saisie: string): ValeurRationnelle {
  const texte = saisie.trim().replace(/\u2212/g, '-').replace(/\s+/g, '');
  if (texte === '') throw new ReponseInvalide('Réponse vide.');

  const fraction = texte.match(/^([+-]?)(\d+)\/(\d+)$/);
  if (fraction) {
    const signe = fraction[1] === '-' ? -1n : 1n;
    const num = BigInt(fraction[2] ?? '0');
    const den = BigInt(fraction[3] ?? '1');
    if (den === 0n) throw new ReponseInvalide('Le dénominateur ne peut pas être nul.');
    return {
      type: 'rationnelle',
      valeur: rationnel(signe * num, den),
      forme: 'fraction',
      numerateurEcrit: num,
      denominateurEcrit: den,
    };
  }

  const decimal = texte.match(/^([+-]?)(\d+)(?:[.,](\d+))?$/);
  if (decimal) {
    const signe = decimal[1] === '-' ? -1n : 1n;
    const entier = BigInt(decimal[2] ?? '0');
    const parties = decimal[3] ?? '';
    const den = 10n ** BigInt(parties.length);
    return {
      type: 'rationnelle',
      valeur: rationnel(signe * (entier * den + BigInt(parties || '0')), den),
      forme: parties === '' ? 'entiere' : 'decimale',
      numerateurEcrit: entier,
      denominateurEcrit: den,
    };
  }

  throw new ReponseInvalide('Nombre attendu, par exemple 7/6 ou -5.');
}

// ---------------------------------------------------------------------------
// Expressions algébriques
// ---------------------------------------------------------------------------

export function analyserExpressionReponse(saisie: string): ValeurExpression {
  if (saisie.trim() === '') throw new ReponseInvalide('Réponse vide.');
  const noeud = analyserExpression(saisie);
  return { type: 'expression', noeud, polynome: versPolynomeVerifie(saisie) };
}

// ---------------------------------------------------------------------------
// Racines carrées
// ---------------------------------------------------------------------------

const MOTIF_RACINE = /^([+-]?)(\d*)√\(?(\d+)\)?$/;

/**
 * Analyse une réponse de la forme `a√b`.
 *
 * La valeur est **normalisée** : `6√8` devient `12√2`, exactement comme on
 * l'écrit au tableau. `50√2` reste `50√2` — c'est bien la faute d'enveloppe,
 * et elle doit rester visible.
 */
export function analyserRacine(saisie: string): ValeurRacine {
  const texte = saisie
    .trim()
    .replace(/\u2212/g, '-')
    .replace(/\s+/g, '')
    .replace(/\u00d7/g, '*')
    .replace(/\*/g, '');
  if (texte === '') throw new ReponseInvalide('Réponse vide.');

  const motif = texte.match(MOTIF_RACINE);
  if (!motif) {
    throw new ReponseInvalide('Réponse attendue sous la forme a√b, par exemple 11√2.');
  }

  const signe = motif[1] === '-' ? -1n : 1n;
  const coefficientSaisi = motif[2] === undefined || motif[2] === '' ? 1n : BigInt(motif[2]);
  const radicandSaisi = Number(motif[3] ?? '0');

  if (radicandSaisi < 0) {
    throw new ReponseInvalide('Le radicand doit être un entier positif.');
  }

  return normaliserRacine(rationnel(signe * coefficientSaisi), radicandSaisi);
}

/**
 * Extrait tous les carrés parfaits du radicand.
 *
 * `√72` → `6√2` : 72 = 2³ × 3², donc on extrait 2 × 3 et il reste 2.
 * Le radicand conservé est la partie **impaire** de chaque exposant, jamais le
 * reste de la division successive — sinon `√72` donnerait `36√1`.
 */
export function normaliserRacine(coefficient: Rational, radicand: number): ValeurRacine {
  if (!Number.isInteger(radicand) || radicand < 0) {
    throw new ReponseInvalide('Le radicand doit être un entier positif.');
  }

  let facteur = 1n;
  let partieImpare = 1n;
  let reste = BigInt(radicand);

  for (const premier of facteursPremiers(reste === 0n ? 1n : reste)) {
    let exposant = 0;
    while (reste % premier === 0n) {
      reste /= premier;
      exposant += 1;
    }
    const paires = Math.floor(exposant / 2);
    if (paires > 0) facteur *= premier ** BigInt(paires);
    if (exposant % 2 === 1) partieImpare *= premier;
  }

  return {
    type: 'racine',
    coefficient: rationnel(coefficient.num * facteur, coefficient.den),
    radicand: Number(partieImpare),
    radicandSaisi: radicand,
  };
}

// ---------------------------------------------------------------------------
// Comparaisons et descriptions
// ---------------------------------------------------------------------------

/** Égalité **exacte** de deux valeurs, indépendamment de leur écriture. */
export function sontEgales(a: Valeur, b: Valeur): boolean {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'rationnelle':
      return b.type === 'rationnelle' && estEgal(a.valeur, b.valeur);
    case 'expression':
      return b.type === 'expression' && comparerPolynomes(a.polynome, b.polynome);
    case 'racine':
      return b.type === 'racine' && a.radicand === b.radicand && estEgal(a.coefficient, b.coefficient);
    default:
      return false;
  }
}

/** Description courte d'une valeur — journaux serveur et tests. */
export function decrire(valeur: Valeur): string {
  switch (valeur.type) {
    case 'rationnelle':
      return `${versChaine(valeur.valeur)} (forme : ${valeur.forme})`;
    case 'racine':
      return `${versChaine(valeur.coefficient)}√${valeur.radicand} (radicand saisi : ${valeur.radicandSaisi})`;
    case 'expression':
      return `expression de degré ${valeur.polynome.length - 1}`;
    default:
      return 'valeur inconnue';
  }
}

/**
 * Vrai si la fraction a été écrite de façon **irréductible**.
 *
 * Le jugement porte sur l'écriture (`numerateurEcrit`, `denominateurEcrit`), pas
 * sur la valeur : la valeur de `14/12` est déjà réduite par construction, et
 * juger dessus rendrait toute fraction « irréductible », donc la consigne
 * « donne le résultat sous forme irréductible » deviendrait inopérante.
 */
export function estIrreductible(valeur: ValeurRationnelle): boolean {
  if (valeur.forme !== 'fraction') return false;
  if (valeur.denominateurEcrit <= 0n) return false;
  return pgcdEntiers(valeur.numerateurEcrit, valeur.denominateurEcrit) === 1n;
}

export { ExpressionRefusee };