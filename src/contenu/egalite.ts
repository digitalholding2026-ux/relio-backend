/**
 * Égalités écrites à la façon du cahier — chantier 7.7, partie C.
 *
 * ## Le problème
 *
 * Sur son cahier, un élève de 3e écrit `A = 2x + 1`. L'application n'acceptait
 * que `2x + 1` : le signe `=` suffisait à faire rejeter une réponse
 * parfaitement correcte, avec le message « Caractère non reconnu : « = ». ».
 *
 * ## Ce qu'on ne fait pas
 *
 * On **ne supprime pas aveuglément** ce qui précède le `=`. Une égalité est une
 * affirmation : `2x = 2x + 1` est fausse, et l'accepter reviendrait à valider
 * n'importe quelle chaîne contenant la bonne réponse.
 *
 * ## La règle appliquée
 *
 * On regarde ce que chaque membre **signifie** :
 *
 * | Membre gauche | Membre droit | Décision |
 * |---|---|---|
 * | illisible seul (un nom, comme `A`) | expression | le nom est l'inconnue de l'énoncé : on analyse le membre droit |
 * | expression | expression | les deux doivent être **égales**, sinon l'énoncé est faux : on analyse le membre droit |
 * | expression | illisible seul | refusé : l'élève a mis la réponse à gauche, on ne devine pas |
 * | illisible | illisible | refusé |
 *
 * ## Pourquoi l'inconnue de l'énoncé passe
 *
 * `A` n'est pas une variable de l'algèbre du moteur : l'analyseur ne connaît
 * que `x`. Un membre gauche qui ne s'analyse **pas** est donc, très
 * probablement, le nom donné à l'inconnue dans l'énoncé. On ne l'accepte que
 * s'il ressemble effectivement à un nom — sinon on refuse.
 *
 * `x = 5`, en revanche, est refusé : `x` s'analyse comme variable, donc les
 * deux membres sont comparés, et `x = 5` n'est pas une identité. C'est le bon
 * refus.
 */

import {
  analyserExpressionReponse,
  analyserRacine,
  analyserRationnel,
  ReponseInvalide,
  sontEgales,
  type Valeur,
} from '../lib/analyseur-reponse.js';
import type { Exercice, TypeReponse } from './types.js';

/** Un nom d'inconnue : une à trois lettres, éventuellement un chiffre. */
const NOM_INCONNUE = /^[A-Za-z][A-Za-z0-9]{0,2}$/;

/** Analyse une saisie selon le type attendu ; `null` si elle est illisible. */
function analyser(type: TypeReponse, texte: string): Valeur | null {
  const propre = texte.trim();
  if (propre === '') return null;
  try {
    if (type === 'expression') return analyserExpressionReponse(propre);
    if (type === 'racine') return analyserRacine(propre);
    return analyserRationnel(propre);
  } catch {
    return null;
  }
}

/**
 * Sépare une égalité en deux membres.
 *
 * Renvoie `null` si la saisie ne contient **pas** d'égalité : le cas ordinaire,
 * où l'analyse se fait directement sur le texte.
 */
export function separerEgalite(saisie: string): { gauche: string; droite: string } | null {
  const propre = saisie.replace(/−/g, '-').trim();
  const morceaux = propre.split('=');

  // Zéro égalité : rien à faire.
  if (morceaux.length === 1) return null;

  // Deux égalités ou plus : la phrase est ambiguë, on ne devine pas.
  if (morceaux.length > 2) {
    throw new ReponseInvalide('Écris une seule égalité : par exemple A = 2x + 1.');
  }

  const gauche = morceaux[0]?.trim() ?? '';
  const droite = morceaux[1]?.trim() ?? '';

  if (gauche === '' || droite === '') {
    throw new ReponseInvalide('Écris l’égalité avec les deux membres, par exemple A = 2x + 1.');
  }

  return { gauche, droite };
}

/**
 * Extrait de la saisie le membre qui constitue la réponse.
 *
 * @throws {ReponseInvalide} si l'égalité est incohérente ou illisible
 */
export function membreReponse(exercice: Exercice, saisie: string): string {
  const egalite = separerEgalite(saisie);

  // Pas d'égalité : la saisie est déjà la réponse. C'est le cas le plus
  // fréquent, et il ne doit rien changer.
  if (egalite === null) return saisie;

  const gauche = analyser(exercice.typeReponse, egalite.gauche);
  const droite = analyser(exercice.typeReponse, egalite.droite);

  if (gauche === null && droite === null) {
    throw new ReponseInvalide(
      'Je n’arrive pas à lire cette égalité. Écris la réponse après le signe « = ».',
    );
  }

  if (gauche === null) {
    // Le membre gauche est le nom de l'inconnue de l'énoncé (`A`, `B`, `K`…).
    if (!NOM_INCONNUE.test(egalite.gauche.replace(/\s+/g, ''))) {
      throw new ReponseInvalide(
        'Je n’arrive pas à lire le membre de gauche. Écris par exemple : A = 2x + 1.',
      );
    }
    return egalite.droite;
  }

  if (droite === null) {
    // Le membre gauche est une expression et le droit un nom : l'élève a mis
    // la réponse à gauche. Refuser est plus honnête que d'inverser sans
    // savoir ce qu'il voulait écrire.
    throw new ReponseInvalide(
      'Mets la réponse après le signe « = », par exemple : A = 2x + 1.',
    );
  }

  // Les deux membres sont des expressions : l'égalité doit être vraie.
  if (!sontEgales(gauche, droite)) {
    throw new ReponseInvalide(
      'Les deux côtés de ton signe « = » ne valent pas la même chose.',
    );
  }

  return egalite.droite;
}