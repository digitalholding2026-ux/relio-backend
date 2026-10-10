import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AIDES_PAR_OBJECTIF,
  AIDES_PAR_SIGNATURE,
  aidePour,
  type ObjectifId,
} from '../src/contenu/aides.js';
import { corriger } from '../src/contenu/correction.js';
import { EXERCICES, trouverExercice } from '../src/contenu/exercices.js';
import { SIGNATURES } from '../src/contenu/signatures.js';
import { OBJECTIFS } from '../src/contenu/blocs.js';
import {
  analyserExpressionReponse,
  analyserRacine,
  analyserRationnel,
  sontEgales,
} from '../src/lib/analyseur-reponse.js';

/**
 * Chantier 7.4 — qualité des messages destinés à l'élève.
 *
 * Le défaut signalé : un élève échouant recevait
 * « Reprends la méthode de OO-L1-2 sur un exemple plus simple. »,
 * où `OO-L1-2` est une clé technique, pas une explication.
 *
 * Ces tests verrouillent quatre propriétés :
 *
 * 1. **aucun identifiant technique** dans un message élève ;
 * 2. **l'aide correspond au bon objectif** — un élève qui factorise ne doit pas
 *    recevoir une leçon sur les racines carrées ;
 * 3. **les exemples annoncés sont mathématiquement exacts** ;
 * 4. **aucune réponse d'exercice n'est donnée** — l'aide guide, elle ne
 *    résout pas l'exercice à la place de l'élève.
 *
 * Les égalités des exemples sont recalculées ici avec le moteur de
 * production : une aide contenant une faute de calcul échouerait.
 */

/** Identifiants techniques : ne doivent jamais atteindre un élève. */
const MOTIF_IDENTIFIANT = /\b(?:OO|LEC|MVP|SONDE)-[A-Z0-9-]+\b/;

/** Tous les textes qu'un élève peut lire, tous exercices et réponses confondus. */
function tousLesTextesEleve(): Array<{ origine: string; texte: string }> {
  const textes: Array<{ origine: string; texte: string }> = [];

  for (const exercice of EXERCICES) {
    const entrees = [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)];

    for (const saisie of entrees) {
      const correction = corriger(exercice, saisie);
      for (const champ of ['explication', 'libelle'] as const) {
        textes.push({ origine: `${exercice.id}/${champ}`, texte: correction[champ] });
      }
    }

    // Les indices sont également affichés à l'élève.
    for (const indice of exercice.indices) {
      textes.push({ origine: `${exercice.id}/indice${indice.palier}`, texte: indice.texte });
    }
  }

  return textes;
}

describe('7.4 — aucun identifiant technique dans un message élève', () => {
  it('ne laisse passer aucun identifiant OO-, LEC- ou MVP-', () => {
    const fautifs = tousLesTextesEleve().filter(({ texte }) => MOTIF_IDENTIFIANT.test(texte));

    assert.deepEqual(
      fautifs.map(({ origine, texte }) => `${origine}: ${texte.slice(0, 70)}`),
      [],
      `${fautifs.length} message(s) exposent un identifiant technique à l'élève.`,
    );
  });

  it('n’affiche plus le message fautif d’origine', () => {
    // Le texte exact du défaut signalé ne doit plus exister nulle part.
    for (const { origine, texte } of tousLesTextesEleve()) {
      assert.doesNotMatch(texte, /Reprends la méthode de OO/, origine);
    }
  });

  it('l’erreur inconnue retombe sur l’aide de l’objectif, sans inventer de cause', () => {
    // `hors_perimetre` signifie « cause inconnue » : le message donne la
    // méthode de la leçon sans prétendre savoir ce qui a échoué.
    const correction = corriger(trouverExercice('MVP-B1-E1')!, '999x + 999');
    assert.equal(correction.signatureErreur, 'hors_perimetre');
    assert.match(correction.explication, /multiplier/i);
    // Il ne doit pas annoncer une cause précise non reconnue.
    assert.doesNotMatch(correction.explication, /tu as oublié|tu as confondu/i);
  });
});

describe('7.4 — l’aide correspond bien à l’objectif', () => {
  it('donne à chaque objectif du MVP une aide qui lui est propre', () => {
    for (const objectif of OBJECTIFS) {
      const aide = aidePour(objectif.id, null);
      assert.ok(aide.length > 40, `${objectif.id} : aide trop courte`);
      assert.doesNotMatch(aide, MOTIF_IDENTIFIANT, objectif.id);
    }
  });

  it('n’y a pas de confusion entre factorisation, racines et développement', () => {
    // Un élève qui factorise ne doit pas lire une leçon sur les racines.
    const factorisation = aidePour('OO-L1-2', null);
    const racines = aidePour('OO-L3-1', null);
    const developpement = aidePour('OO-L1-1', null);

    assert.match(factorisation, /trouver un nombre ou une lettre qui divise/i);
    assert.match(factorisation, /3\(x \+ 2\)/, 'L’exemple de factorisation doit être présent.');

    assert.match(racines, /racine/i);
    assert.match(racines, /carré parfait/i);
    assert.doesNotMatch(racines, /3x \+ 6/, 'Une racine ne doit pas recevoir un exemple de factorisation.');

    assert.match(developpement, /multiplier chaque terme/i);
    assert.match(developpement, /2\(x \+ 3\)/);
    assert.doesNotMatch(developpement, /3\(x \+ 2\)/, 'Le développement ne doit pas utiliser un exemple de factorisation.');
  });

  it('donne à chaque exercice l’aide de son propre objectif', () => {
    for (const exercice of EXERCICES) {
      const attendue = AIDES_PAR_OBJECTIF[exercice.objectifs[0] as ObjectifId];
      assert.ok(attendue, `${exercice.id} : objectif inconnu ${exercice.objectifs[0]}`);

      // Une erreur inconnue doit déclencher exactement cette aide.
      const aide = aidePour(exercice.objectifs[0] ?? '', null);
      assert.ok(
        aide.includes(attendue.action),
        `${exercice.id} : l'aide ne correspond pas à l'objectif ${exercice.objectifs[0]}.`,
      );
    }
  });

  it('privilégie l’aide de la signature quand la cause est connue', () => {
    // Cause reconnue : le message doit être celui de l'erreur, pas celui de
    // l'objectif. C'est plus utile.
    const signe = AIDES_PAR_SIGNATURE.signe_non_distribue;
    assert.ok(signe);
    assert.equal(aidePour('OO-L1-2', 'signe_non_distribue'), signe);
    assert.notEqual(aidePour('OO-L1-2', 'signe_non_distribue'), aidePour('OO-L1-2', null));
  });

  it('retombe sur l’aide d’objectif pour les signatures sans message dédié', () => {
    // `hors_perimetre` et les deux signatures d'équation (hors MVP) n'ont pas
    // d'aide dédiée : l'objectif prend le relais.
    for (const signature of ['hors_perimetre', 'signe_perdu_en_resolution', 'resolution_incompletee'] as const) {
      assert.equal(aidePour('OO-L1-1', signature), aidePour('OO-L1-1', null), signature);
    }
  });
});

describe('7.4 — les exemples mathématiques annoncés sont exacts', () => {
  /** Vérifie une égalité d'expressionsalgébriques. */
  function verifieExpression(gauche: string, droite: string): boolean {
    return sontEgales(analyserExpressionReponse(gauche), analyserExpressionReponse(droite));
  }

  /** Vérifie une égalité de racines : `√n = k√m`. */
  function verifieRacine(n: number, k: number, m: number): boolean {
    // n doit valoir k² × m, et m ne doit pas avoir de facteur carré.
    if (k * k * m !== n) return false;
    const gauche = analyserRacine(`${k}√${m}`);
    const droite = analyserRacine(`√${n}`);
    return sontEgales(gauche, droite) && gauche.radicand === m;
  }

  it('OO-L1-1 : les exemples de développement sont exacts', () => {
    assert.ok(verifieExpression('2(x + 3)', '2x + 6'), '2(x+3) = 2x+6');
    assert.ok(verifieExpression('3(x - 4)', '3x - 12'), '3(x-4) = 3x-12');
  });

  it('OO-L1-2 : les exemples de factorisation sont exacts', () => {
    assert.ok(verifieExpression('3x + 6', '3(x + 2)'), '3x+6 = 3(x+2)');
    assert.ok(verifieExpression('4x^2 - 9', '(2x-3)(2x+3)'), '4x²-9 = (2x-3)(2x+3)');
  });

  it('OO-L3-1 : les exemples de racines sont exacts', () => {
    assert.ok(verifieRacine(63, 3, 7), '√63 = 3√7');
    assert.ok(verifieRacine(147, 7, 3), '√147 = 7√3');
  });

  it('OO-L5-1 : l’exemple d’addition de fractions est exact', () => {
    // L'addition annoncée : 1/2 + 1/3 = 3/6 + 2/6 = 5/6.
    assert.ok(
      sontEgales(analyserRationnel('1/2'), analyserRationnel('3/6')),
      '1/2 = 3/6',
    );
    assert.ok(
      sontEgales(analyserRationnel('1/3'), analyserRationnel('2/6')),
      '1/3 = 2/6',
    );
    // La somme annoncée doit valoir exactement 5/6, et être irréductible.
    const somme = analyserRationnel('5/6');
    assert.equal(somme.valeur.num, 5n);
    assert.equal(somme.valeur.den, 6n);
  });

  it('OO-L5-2 : l’exemple de réduction est exact', () => {
    assert.ok(sontEgales(analyserRationnel('6/8'), analyserRationnel('3/4')), '6/8 = 3/4');
  });

  it('les exemples des messages de signature sont exacts', () => {
    // Signatures citant une égalité résolue.
    assert.ok(verifieExpression('-(x + 3)', '-x - 3'), '−(x+3) = −x−3');
    assert.ok(verifieExpression('x + x + 3', '2x + 3'), 'x+x+3 = 2x+3');
    assert.ok(verifieExpression('x^2 - 4', '(x-2)(x+2)'), 'x²-4 = (x-2)(x+2)');
    assert.ok(verifieRacine(175, 5, 7), '√175 = 5√7');
  });
});

describe('7.4 — l’aide ne donne pas la réponse de l’exercice', () => {
  it('ne contient jamais la réponse attendue d’un exercice du même objectif', () => {
    // Règle : l'exemple de l'aide ne doit jamais être la solution de
    // l'exercice que l'élève est en train de faire.
    for (const exercice of EXERCICES) {
      const aide = aidePour(exercice.objectifs[0] ?? '', null);
      assert.ok(
        !aide.includes(exercice.reponseAttendue),
        `${exercice.id} : l'aide donne la réponse attendue « ${exercice.reponseAttendue} ».`,
      );
    }
  });

  it('ne laisse fuir la réponse attendue par aucun message de correction', () => {
    for (const exercice of EXERCICES) {
      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        const correction = corriger(exercice, saisie);
        for (const champ of ['explication', 'libelle'] as const) {
          assert.ok(
            !correction[champ].includes(exercice.reponseAttendue),
            `${exercice.id} / ${saisie} : « ${champ} » donne la réponse attendue.`,
          );
        }
      }
    }
  });

  it('donne une aide quand même, même si elle ne doit rien divulguer', () => {
    // La prudence ne doit pas produire un silence inutile : une réponse fausse
    // mais **analysable** doit toujours recevoir une aide lisible.
    //
    // Le quotient est choisi par type d'exercice : `0` est une réponse
    // analysable partout, sauf pour une racine, où la grammaire exige la
    // forme `a√b` — et là, refuser est le comportement correct.
    const REPONSE_FAUSSE: Record<string, string> = {
      rationnelle: '1/2',
      expression: 'x + 1',
      racine: '3√7',
    };

    for (const exercice of EXERCICES) {
      const correction = corriger(exercice, REPONSE_FAUSSE[exercice.typeReponse] ?? '0');
      assert.equal(correction.statut, 'fausse', `${exercice.id} : statut inattendu`);
      assert.ok(correction.explication.length > 40, `${exercice.id} : message trop court`);
      assert.doesNotMatch(correction.explication, MOTIF_IDENTIFIANT, `${exercice.id} : identifiant exposé`);
    }
  });
});

describe('7.4 — progression des indices', () => {
  it('conserve trois paliers progressifs sur les douze exercices', () => {
    for (const exercice of EXERCICES) {
      assert.equal(exercice.indices.length, 3, `${exercice.id} : nombre de paliers`);

      const paliers = exercice.indices.map((i) => i.palier).sort();
      assert.deepEqual(paliers, [1, 2, 3], `${exercice.id} : paliers incohérents`);

      // Aucun indice ne doit contenir d'identifiant technique.
      for (const indice of exercice.indices) {
        assert.doesNotMatch(indice.texte, MOTIF_IDENTIFIANT, `${exercice.id}/indice${indice.palier}`);
      }

      // Aucun indice ne doit donner la réponse attendue : c'est au Corrections
      // que revient ce rôle, et le palier 3 s'arrête à la première ligne.
      for (const indice of exercice.indices) {
        assert.ok(
          !indice.texte.includes(exercice.reponseAttendue),
          `${exercice.id}/indice${indice.palier} : donne la réponse attendue.`,
        );
      }
    }
  });

  it('ne donne pas la réponse avant le dernier palier', () => {
    // La progression se mesure à ce que chaque palier **révèle**, pas à sa
    // longueur : un palier 1 long peut poser le décor, un palier 3 court
    // peut être très directif.
    //
    // Ce qui doit être vrai : les paliers 1 et 2 ne montrent jamais la
    // réponse attendue. Le palier 3 s'arrête à la dernière ligne utile.
    for (const exercice of EXERCICES) {
      const [p1, p2, p3] = exercice.indices;
      if (!p1 || !p2 || !p3) continue;

      assert.ok(
        !p1.texte.includes(exercice.reponseAttendue),
        `${exercice.id} : le palier 1 donne la réponse.`,
      );
      assert.ok(
        !p2.texte.includes(exercice.reponseAttendue),
        `${exercice.id} : le palier 2 donne la réponse.`,
      );
      // Le palier 3 guide la dernière transformation sans achever le
      // résultat : il contient la méthode, pas la conclusion.
      assert.ok(
        p3.texte.length > 10,
        `${exercice.id} : le palier 3 doit guider, pas être vide.`,
      );
    }
  });

  it('oriente le palier 1 vers l’action, sans l’expliquer', () => {
    // Le palier 1 doit nommer une opération mathématique, pas donner le
    // détail du calcul.
    for (const exercice of EXERCICES) {
      const premier = exercice.indices[0];
      assert.ok(premier);
      assert.ok(
        premier.texte.length < 140,
        `${exercice.id} : le palier 1 est trop détaillé (${premier.texte.length} caractères).`,
      );
    }
  });
});

describe('7.4 — cohérence avec la décision D5', () => {
  it('donne une aide exploitable pour chaque verdict', () => {
    const CAS: ReadonlyArray<readonly [string, string]> = [
      ['MVP-B1-E4', '(2x-3)(2x+3)'],
      ['MVP-B1-E4', '4x^2 - 9'],
      ['MVP-B2-E1', '√(25×2)'],
      ['MVP-B2-E1', '7√2'],
      ['MVP-B3-E3', '24/36'],
    ];

    for (const [id, reponse] of CAS) {
      const exercice = trouverExercice(id);
      assert.ok(exercice, `${id} introuvable`);
      const correction = corriger(exercice, reponse);

      assert.ok(correction.libelle.length > 10, `${id} / ${reponse} : libellé trop court`);
      assert.doesNotMatch(correction.libelle, MOTIF_IDENTIFIANT, `${id} : identifiant dans le libellé`);
      assert.doesNotMatch(correction.explication, MOTIF_IDENTIFIANT, `${id} : identifiant dans l'explication`);
      assert.ok(correction.explication.length > 20, `${id} : explication trop courte`);
    }
  });

  it('donne une explication différente pour les quatre verdicts', () => {
    // Un même message pour « juste mais mal formé » et « incorrect »
    // serait la même erreur que celle corrigée : l'élève ne comprendrait pas
    // ce qui change.
    const casA = corriger(trouverExercice('MVP-B3-E3')!, '24/36');
    const casC = corriger(trouverExercice('MVP-B3-E3')!, '7/13');
    assert.notEqual(casA.verdict, casC.verdict);
    assert.notEqual(casA.explication, casC.explication);
    assert.notEqual(casA.libelle, casC.libelle);
  });

  it('couvre tout le catalogue de signatures sans identifiant', () => {
    for (const signature of SIGNATURES) {
      const aide = AIDES_PAR_SIGNATURE[signature];
      if (aide === undefined) continue;
      assert.ok(aide.length > 20, `${signature} : aide trop courte`);
      assert.doesNotMatch(aide, MOTIF_IDENTIFIANT, signature);
    }
  });

  it('donne un filet lisible si l’objectif est inconnu', () => {
    // Ne doit pas arriver dans le MVP, mais le filet reste lisible.
    const aide = aidePour('OBJECTIF-QUI-EXISTE-PAS', null);
    assert.ok(aide.length > 20);
    assert.doesNotMatch(aide, MOTIF_IDENTIFIANT);
    assert.doesNotMatch(aide, /OBJECTIF-QUI-EXISTE-PAS/);
  });
});