/**
 * Analyse et évaluation **exacte** d'expressions algébriques.
 *
 * Pourquoi un moteur à côté, plutôt qu'une comparaison de chaînes ?
 *
 * `4(x-1)(x+2)` et `(2x-2)(2x+4)` sont différents comme texte et **égaux comme
 * expressions**. Une correction par chaîne refuserait une réponse juste, et
 * surtout elle **ne pourrait pas distinguer** une réponse juste d'une réponse
 * obtenue par hasard. Le chantier 6 (F1) a établi ce point : la justesse
 * mathématique et le respect de la forme sont **deux jugements séparés**, et
 * seul le premier se décide par l'égalité algébrique.
 *
 * Le moteur est volontairement restreint : une seule variable (`x`), des
 * coefficients rationnels exacts, des puissances entières. Toute expression
 * qui sort de ce cadre est refusée (`ExpressionRefusee`) plutôt que devinée.
 */

import {
  oppose,
  produit,
  quotient,
  rationnel,
  somme,
  UN,
  ZERO,
  type Rational,
} from './algebre.js';

/** Expression hors du modèle accepté : jamais devinée, toujours refusée. */
export class ExpressionRefusee extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ExpressionRefusee';
  }
}

// ---------------------------------------------------------------------------
// Arbre syntaxique
// ---------------------------------------------------------------------------

export type Noeud =
  | { t: 'nombre'; valeur: Rational }
  | { t: 'variable' }
  | { t: 'somme'; gauche: Noeud; droite: Noeud }
  | { t: 'difference'; gauche: Noeud; droite: Noeud }
  | { t: 'produit'; gauche: Noeud; droite: Noeud }
  | { t: 'quotient'; gauche: Noeud; droite: Noeud }
  | { t: 'puissance'; base: Noeud; exposant: number };

// ---------------------------------------------------------------------------
// Analyse lexicale
// ---------------------------------------------------------------------------

type Jeton =
  | { type: 'nombre'; valeur: Rational }
  | { type: 'identifiant' }
  | { type: 'operateur'; valeur: '+' | '-' | '*' | '/' | '^' }
  | { type: 'parenthese'; valeur: '(' | ')' };

/** Unités de saisie tolérées, pour que le mobile n'impose pas de frappe au clavier. */
function normaliser(saisie: string): string {
  return saisie
    .replace(/\u2212/g, '-') // − (moins mathématique)
    .replace(/[\u2013\u2014]/g, '-') // – —
    .replace(/\u00d7/g, '*') // ×
    .replace(/\u00b7/g, '*') // ·
    .replace(/\u221a/g, '√') // √
    .replace(/\u00a0/g, ' ')
    .replace(/\^/g, '^')
    .replace(/\u00b2/g, '^2'); // ²
}

function analyserJetons(saisie: string): Jeton[] {
  const texte = normaliser(saisie);
  const jetons: Jeton[] = [];
  let i = 0;

  while (i < texte.length) {
    const c = texte[i] ?? '';

    if (c === ' ') {
      // Espace entre deux binaires : marque d'une multiplication.
      const avant = jetons[jetons.length - 1];
      const apres = texte[i + 1];
      const estBinaireAvant =
        avant !== undefined &&
        (avant.type === 'nombre' ||
          (avant.type === 'operateur' && avant.valeur === '^') ||
          (avant.type === 'parenthese' && avant.valeur === ')'));
      const estBinaireApres = apres !== undefined && /[0-9(]/.test(apres);
      if (estBinaireAvant && estBinaireApres) {
        jetons.push({ type: 'operateur', valeur: '*' });
      }
      i += 1;
      continue;
    }

    if (/[0-9]/.test(c)) {
      let brut = '';
      while (i < texte.length && /[0-9.]/.test(texte[i] ?? '')) {
        brut += texte[i];
        i += 1;
      }
      if (brut.split('.').length > 2) {
        throw new ExpressionRefusee('Nombre illisible.');
      }
      if (brut.includes('.')) {
        const [entier = '0', decimal = ''] = brut.split('.');
        const den = 10n ** BigInt(decimal.length);
        jetons.push({
          type: 'nombre',
          valeur: rationnel(BigInt(entier) * den + BigInt(decimal), den),
        });
      } else {
        jetons.push({ type: 'nombre', valeur: rationnel(BigInt(brut)) });
      }
      continue;
    }

    if (c === 'x') {
      jetons.push({ type: 'identifiant' });
      i += 1;
      continue;
    }

    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      jetons.push({ type: 'operateur', valeur: c });
      i += 1;
      continue;
    }

    if (c === '(' || c === ')') {
      jetons.push({ type: 'parenthese', valeur: c });
      i += 1;
      continue;
    }

    throw new ExpressionRefusee(`Caractère non reconnu : « ${c} ».`);
  }

  return jetons;
}

// ---------------------------------------------------------------------------
// Analyse syntaxique
// ---------------------------------------------------------------------------

/**
 * Multiplication implicite : `2x`, `3(x+1)`, `(x+1)(x-2)`.
 * Un facteur (`2`, `x`, `(…)`) peut être suivi d'un facteur sans opérateur.
 */
function debutDeFacteur(jeton: Jeton | undefined): boolean {
  return (
    jeton !== undefined &&
    (jeton.type === 'nombre' ||
      jeton.type === 'identifiant' ||
      (jeton.type === 'parenthese' && jeton.valeur === '('))
  );
}

class AnalyseurSyntaxique {
  private readonly jetons: Jeton[];
  private position = 0;

  public constructor(jetons: Jeton[]) {
    this.jetons = jetons;
  }

  public analyserExpression(): Noeud {
    const noeud = this.analyserSomme();
    if (this.position < this.jetons.length) {
      throw new ExpressionRefusee('Expression incomplète ou opérateur en trop.');
    }
    return noeud;
  }

  private peek(): Jeton | undefined {
    return this.jetons[this.position];
  }

  private analyserSomme(): Noeud {
    let gauche = this.analyserProduit();
    for (;;) {
      const jeton = this.peek();
      if (jeton?.type === 'operateur' && (jeton.valeur === '+' || jeton.valeur === '-')) {
        this.position += 1;
        const droite = this.analyserProduit();
        gauche =
          jeton.valeur === '+'
            ? { t: 'somme', gauche, droite }
            : { t: 'difference', gauche, droite };
        continue;
      }
      return gauche;
    }
  }

  private analyserProduit(): Noeud {
    let gauche = this.analyserPuissance();
    for (;;) {
      const jeton = this.peek();

      if (jeton?.type === 'operateur' && jeton.valeur === '*') {
        this.position += 1;
        const droite = this.analyserPuissance();
        gauche = { t: 'produit', gauche, droite };
        continue;
      }

      if (jeton?.type === 'operateur' && jeton.valeur === '/') {
        this.position += 1;
        const droite = this.analyserPuissance();
        gauche = { t: 'quotient', gauche, droite };
        continue;
      }

      // Multiplication implicite.
      if (debutDeFacteur(jeton)) {
        const droite = this.analyserPuissance();
        gauche = { t: 'produit', gauche, droite };
        continue;
      }

      return gauche;
    }
  }

  private analyserPuissance(): Noeud {
    const base = this.analyserFacteur();
    const jeton = this.peek();
    if (jeton?.type === 'operateur' && jeton.valeur === '^') {
      this.position += 1;
      const exposant = this.analyserFacteur();
      if (exposant.t !== 'nombre') {
        throw new ExpressionRefusee('L’exposant doit être un entier positif.');
      }
      const n = Number(exposant.valeur.num);
      if (exposant.valeur.den !== 1n || !Number.isInteger(n) || n < 0 || n > 16) {
        throw new ExpressionRefusee('L’exposant doit être un entier entre 0 et 16.');
      }
      return { t: 'puissance', base, exposant: n };
    }
    return base;
  }

  private analyserFacteur(): Noeud {
    const jeton = this.peek();

    if (jeton === undefined) {
      throw new ExpressionRefusee('Expression incomplète.');
    }

    if (jeton.type === 'operateur' && jeton.valeur === '-') {
      this.position += 1;
      return {
        t: 'produit',
        gauche: { t: 'nombre', valeur: rationnel(-1n) },
        droite: this.analyserFacteur(),
      };
    }

    if (jeton.type === 'operateur' && jeton.valeur === '+') {
      this.position += 1;
      return this.analyserFacteur();
    }

    if (jeton.type === 'nombre') {
      this.position += 1;
      return { t: 'nombre', valeur: jeton.valeur };
    }

    if (jeton.type === 'identifiant') {
      this.position += 1;
      return { t: 'variable' };
    }

    if (jeton.type === 'parenthese' && jeton.valeur === '(') {
      this.position += 1;
      const interne = this.analyserSomme();
      const fermeture = this.peek();
      if (fermeture?.type !== 'parenthese' || fermeture.valeur !== ')') {
        throw new ExpressionRefusee('Parenthèse non fermée.');
      }
      this.position += 1;
      return interne;
    }

    throw new ExpressionRefusee('Expression invalide.');
  }
}

/** Analyse une saisie et renvoie son arbre syntaxique. Lève `ExpressionRefusee`. */
export function analyserExpression(saisie: string): Noeud {
  const jetons = analyserJetons(saisie);
  if (jetons.length === 0) {
    throw new ExpressionRefusee('Réponse vide.');
  }
  return new AnalyseurSyntaxique(jetons).analyserExpression();
}

// ---------------------------------------------------------------------------
// Polynômes — coefficients rationnels exacts, indice = degré
// ---------------------------------------------------------------------------

export type Polynome = Rational[];

export const polynomeNul: Polynome = [];

function degree(p: Polynome): number {
  return p.length - 1;
}

function Sajouter(p: Polynome, d: number, valeur: Rational): void {
  p[d] = valeur;
}

function estZero(v: Rational | undefined): boolean {
  return v === undefined || v.num === 0n;
}

function complet(p: Polynome): Polynome {
  let dernier = p.length - 1;
  while (dernier > 0 && p[dernier] !== undefined && estZero(p[dernier])) {
    dernier -= 1;
  }
  return p.slice(0, dernier + 1);
}

function depuisNoeud(noeud: Noeud, profondeur: number): Polynome {
  if (profondeur > 64) {
    throw new ExpressionRefusee('Expression trop imbriquée.');
  }

  switch (noeud.t) {
    case 'nombre':
      return [noeud.valeur];
    case 'variable':
      return [ZERO, UN];
    case 'somme':
      return additionner(
        depuisNoeud(noeud.gauche, profondeur + 1),
        depuisNoeud(noeud.droite, profondeur + 1),
      );
    case 'difference': {
      const droite = depuisNoeud(noeud.droite, profondeur + 1);
      return additionner(
        depuisNoeud(noeud.gauche, profondeur + 1),
        droite.map(oppose),
      );
    }
    case 'produit': {
      const a = depuisNoeud(noeud.gauche, profondeur + 1);
      const b = depuisNoeud(noeud.droite, profondeur + 1);
      const resultat: Polynome = [];
      for (let i = 0; i < a.length; i += 1) {
        const ai = a[i];
        if (ai === undefined || estZero(ai)) continue;
        for (let j = 0; j < b.length; j += 1) {
          const bj = b[j];
          if (bj === undefined || estZero(bj)) continue;
          const d = i + j;
          const courant = resultat[d];
          Sajouter(
            resultat,
            d,
            courant === undefined ? produit(ai, bj) : somme(courant, produit(ai, bj)),
          );
        }
      }
      return complet(resultat);
    }
    case 'quotient': {
      const num = depuisNoeud(noeud.gauche, profondeur + 1);
      const den = depuisNoeud(noeud.droite, profondeur + 1);
      // Un quotient par un polynôme non constant ne produit pas un polynôme.
      // Plutôt que d'approximer, on refuse : le moteur ne devine jamais.
      if (degree(den) > 0) {
        throw new ExpressionRefusee(
          'La division par une expression contenant x n’est pas supportée ici.',
        );
      }
      const diviseur = den[0];
      if (diviseur === undefined || estZero(diviseur)) {
        throw new ExpressionRefusee('Division par zéro.');
      }
      return complet(num.map((c) => quotient(c, diviseur)));
    }
    case 'puissance': {
      const base = depuisNoeud(noeud.base, profondeur + 1);
      let resultat: Polynome = [UN];
      for (let k = 0; k < noeud.exposant; k += 1) {
        const suivant: Polynome = [];
        for (let i = 0; i < resultat.length; i += 1) {
          const ri = resultat[i];
          if (ri === undefined || estZero(ri)) continue;
          for (let j = 0; j < base.length; j += 1) {
            const bj = base[j];
            if (bj === undefined || estZero(bj)) continue;
            const d = i + j;
            const courant = suivant[d];
            Sajouter(
              suivant,
              d,
              courant === undefined ? produit(ri, bj) : somme(courant, produit(ri, bj)),
            );
          }
        }
        resultat = complet(suivant);
      }
      return resultat;
    }
    default:
      throw new ExpressionRefusee('Expression non prise en charge.');
  }
}

function additionner(a: Polynome, b: Polynome): Polynome {
  const longueur = Math.max(a.length, b.length);
  const resultat: Polynome = [];
  for (let i = 0; i < longueur; i += 1) {
    const total = somme(a[i] ?? ZERO, b[i] ?? ZERO);
    if (estZero(total)) continue;
    Sajouter(resultat, i, total);
  }
  return complet(resultat);
}

/** Convertit une saisie en polynôme exact. Lève `ExpressionRefusee`. */
export function versPolynome(saisie: string): Polynome {
  return depuisNoeud(analyserExpression(saisie), 0);
}

/** Degré maximal accepté — borne de sécurité, pas une limite pédagogique. */
export const DEGRE_MAX = 16;

export function versPolynomeVerifie(saisie: string): Polynome {
  const p = versPolynome(saisie);
  if (degree(p) > DEGRE_MAX) {
    throw new ExpressionRefusee('Degré trop élevé.');
  }
  return p;
}

/** Comparaison **exacte** de deux expressions, quelle que soit leur écriture. */
export function sontAlgebriquementEgales(a: string, b: string): boolean {
  return comparerPolynomes(versPolynomeVerifie(a), versPolynomeVerifie(b));
}

export function comparerPolynomes(a: Polynome, b: Polynome): boolean {
  const longueur = Math.max(a.length, b.length);
  for (let i = 0; i < longueur; i += 1) {
    const va = a[i] ?? ZERO;
    const vb = b[i] ?? ZERO;
    if (va.num * vb.den !== vb.num * va.den) return false;
  }
  return true;
}

/** Vrai si l'expression est écrite comme un produit d'au moins deux facteurs. */
export function estProduitDeFacteurs(noeud: Noeud): boolean {
  return noeud.t === 'produit' && compterFacteurs(noeud) >= 2;
}

function compterFacteurs(noeud: Noeud): number {
  if (noeud.t === 'produit') {
    return compterFacteurs(noeud.gauche) + compterFacteurs(noeud.droite);
  }
  return 1;
}

/** Nombre de termes d'une somme ou d'une différence, au premier niveau. */
export function nombreDeTermes(noeud: Noeud): number {
  if (noeud.t === 'somme' || noeud.t === 'difference') {
    return nombreDeTermes(noeud.gauche) + nombreDeTermes(noeud.droite);
  }
  return 1;
}