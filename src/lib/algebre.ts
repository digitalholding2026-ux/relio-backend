/**
 * Arithmétique rationnelle exacte.
 *
 * Toute la correction du MVP repose sur des comparaisons **exactes** :
 * `1/3` ne doit jamais être Approximé par `0.333`.
 *
 * `Number` est proscrit dans ce module : il ne peut représenter ni 1/3, ni
 * des coefficients algébriques comme 29/18 sans perte. Le type `Rational`
 * encapsule un couple de `bigint` et normalise toujours le résultat.
 */

/** Fraction exacte, toujours sous forme irréductible et de dénominateur positif. */
export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x;
}

/** Construit une fraction exacte et normalisée. Lève si le dénominateur est nul. */
export function rationnel(num: bigint | number, den: bigint | number = 1n): Rational {
  const n = BigInt(num);
  const d = BigInt(den);
  if (d === 0n) throw new Error('Division par zéro.');
  if (d < 0n) {
    return rationnel(-n, -d);
  }
  const g = gcd(n, d) || 1n;
  return { num: n / g, den: d / g };
}

export const ZERO = rationnel(0n);
export const UN = rationnel(1n);

export function estEgal(a: Rational, b: Rational): boolean {
  return a.num === b.num && a.den === b.den;
}

export function somme(a: Rational, b: Rational): Rational {
  return rationnel(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function oppose(a: Rational): Rational {
  return { num: -a.num, den: a.den };
}

export function produit(a: Rational, b: Rational): Rational {
  return rationnel(a.num * b.num, a.den * b.den);
}

export function quotient(a: Rational, b: Rational): Rational {
  if (b.num === 0n) throw new Error('Division par zéro.');
  return rationnel(a.num * b.den, a.den * b.num);
}

/** Vrai si la fraction est un entier — c'est le critère de `forme: 'entiere'`. */
export function estEntier(a: Rational): boolean {
  return a.den === 1n;
}

export function versNombre(a: Rational): number {
  return Number(a.num) / Number(a.den);
}

export function versChaine(a: Rational): string {
  return a.den === 1n ? `${a.num}` : `${a.num}/${a.den}`;
}

/** Plus grand commun diviseur de deux entiers, en valeur absolue. */
export function pgcdEntiers(a: bigint, b: bigint): bigint {
  return gcd(a, b);
}

/** Vrai si `n` est un carré parfait exact. */
export function estCarreParfait(n: bigint): boolean {
  return racineCarreeEntiere(n) !== null;
}

/** Racine carrée entière exacte de `n`, ou `null` si `n` n'est pas un carré parfait. */
export function racineCarreeEntiere(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let bas = 1n;
  let haut = n;
  while (bas <= haut) {
    const milieu = (bas + haut) / 2n;
    const carre = milieu * milieu;
    if (carre === n) return milieu;
    if (carre < n) bas = milieu + 1n;
    else haut = milieu - 1n;
  }
  return null;
}

/** Factorisation en facteurs premiers d'un entier positif. */
export function facteursPremiers(n: bigint): Array<bigint> {
  const facteurs: bigint[] = [];
  let reste = n;
  let diviseur = 2n;
  while (diviseur * diviseur <= reste) {
    while (reste % diviseur === 0n) {
      facteurs.push(diviseur);
      reste /= diviseur;
    }
    diviseur += 1n;
  }
  if (reste > 1n) facteurs.push(reste);
  return facteurs;
}