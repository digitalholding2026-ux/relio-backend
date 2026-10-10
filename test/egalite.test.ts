/**
 * Chantier 7.7 — écritures usuelles et langage simple.
 *
 * Deux voilets très différents, donc deux fichiers.
 *
 * Ce fichier couvre **la grammaire** : accepter `A = 2x + 1` comme l'élève
 * l'écrit sur son cahier, sans jamais valider une égalité fausse.
 *
 * L'ironie du chantier : le risque n'est pas d'accepter `A = 2x + 1`, c'est
 * d'accepter **trop**. Une égalité est une affirmation ; si l'on se contente de
 * supprimer ce qui précède le `=`, alors `2x = 2x + 1` devient une réponse
 * juste. Ces tests verrouillent les refus autant que les acceptations.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { corriger } from '../src/contenu/correction.js';
import { membreReponse, separerEgalite } from '../src/contenu/egalite.js';
import { trouverExercice } from '../src/contenu/exercices.js';
import { EXERCICES } from '../src/contenu/exercices.js';
import { ReponseInvalide } from '../src/lib/analyseur-reponse.js';

function corriger_(id: string, saisie: string) {
  const exercice = trouverExercice(id);
  assert.ok(exercice, `${id} : exercice introuvable`);
  return corriger(exercice, saisie);
}

describe('7.7 — une égalité écrite comme au cahier est acceptée', () => {
  it('accepte « A = 2x + 1 » sur MVP-B1-E1', () => {
    const resultat = corriger_('MVP-B1-E1', 'A = 2x + 1');
    assert.equal(resultat.verdict, 'correct');
    assert.equal(resultat.mathemathiquementJuste, true);
  });

  it('accepte la même réponse sans le nom de l’inconnue', () => {
    // Les deux écritures doivent aboutir au même verdict : c'est la forme de
    // l'énoncé, pas la réponse, qui change.
    const avec = corriger_('MVP-B1-E1', 'A = 2x + 1');
    const sans = corriger_('MVP-B1-E1', '2x + 1');
    assert.equal(avec.verdict, sans.verdict);
    assert.equal(avec.mathemathiquementJuste, sans.mathemathiquementJuste);
  });

  it('accepte le nom réel de chaque exercice', () => {
    // Les exercices n'utilisent pas tous la même lettre : B, D, E, F, G, J…
    for (const [id, nom, reponse] of [
      ['MVP-B1-E4', 'D', '(2x-3)(2x+3)'],
      ['MVP-B1-E5', 'E', 'x(x-7)'],
      ['MVP-B2-E1', 'G', '5√2'],
      ['MVP-B3-E1', 'J', '1/8'],
    ] as const) {
      const resultat = corriger_(id, `${nom} = ${reponse}`);
      assert.equal(resultat.verdict, 'correct', `${id} avec « ${nom} = ${reponse} »`);
    }
  });

  it('accepte une égalité dont les deux membres sont des expressions', () => {
    // L'élève écrit le calcul puis sa forme finale.
    const resultat = corriger_('MVP-B1-E4', '4x^2 - 9 = (2x-3)(2x+3)');
    assert.equal(resultat.verdict, 'correct');
  });

  it('accepte les espaces, ou leur absence', () => {
    for (const saisie of ['A=2x+1', 'A   =   2x + 1', 'A = 2x+1']) {
      assert.equal(corriger_('MVP-B1-E1', saisie).verdict, 'correct', saisie);
    }
  });

  it('accepte les autres signes moins', () => {
    // Un élève tape parfois le moins d'un autre clavier.
    for (const saisie of ['D = (2x−3)(2x+3)', 'D = (2x-3)(2x+3)']) {
      const resultat = corriger_('MVP-B1-E4', saisie);
      assert.equal(resultat.verdict, 'correct', saisie);
    }
  });
});

describe('7.7 — une égalité fausse ou ambiguë est refusée', () => {
  function refus(id: string, saisie: string): string {
    try {
      const resultat = corriger_(id, saisie);
      assert.fail(`${saisie} aurait dû être refusée (verdict ${resultat.verdict})`);
    } catch (erreur) {
      assert.ok(erreur instanceof ReponseInvalide, `${saisie} : refus inattendu`);
      return erreur.message;
    }
  }

  it('refuse une égalité dont les deux côtés diffèrent', () => {
    // Le cas que la suppression aveugle aurait laissé passer.
    const message = refus('MVP-B1-E1', 'x = 2x + 1');
    assert.match(message, /ne valent pas la même chose/i);
  });

  it('refuse une égalité fausse même si la réponse attendue apparaît à droite', () => {
    // `0x = 2x + 1` contient bien la bonne réponse, et n'est pas vrai.
    refus('MVP-B1-E1', '0x = 2x + 1');
    refus('MVP-B1-E1', 'x - x = 2x + 1');
  });

  it('refuse deux signe « = »', () => {
    const message = refus('MVP-B1-E1', 'A = B = 2x + 1');
    assert.match(message, /une seule égalité/i);
  });

  it('refuse un membre de gauche qui n’est ni un nom ni une expression', () => {
    refus('MVP-B1-E1', '2 + = 2x + 1');
    refus('MVP-B1-E1', '?? = 2x + 1');
  });

  it('refuse un membre de gauche illisible qui n’est pas un nom d’inconnue', () => {
    refus('MVP-B1-E1', '3(x + 1) + = 2x + 1');
  });

  it('refuse un membre vide', () => {
    refus('MVP-B1-E1', '= 2x + 1');
    refus('MVP-B1-E1', 'A = ');
  });

  it('demande la réponse du bon côté plutôt que de l’inventer', () => {
    // L'élève a mis la réponse à gauche : on ne devine pas son intention.
    const message = refus('MVP-B1-E1', '2x + 1 = A');
    assert.match(message, /après le signe/i);
  });

  it('refuse une racine incohérente', () => {
    // Les deux membres s'analysent : l'égalité doit être vraie.
    refus('MVP-B2-E1', '5√2 = 5√3');
    refus('MVP-B2-E1', '5√2 = 3√2');
  });

  it('refuse une fraction incohérente', () => {
    refus('MVP-B3-E1', '1/8 = 1/4');
    refus('MVP-B3-E1', '2/16 = 1/4');
  });

  it('accepte « x = valeur » quand x n’est pas analysable comme valeur', () => {
    /*
     * Règle à énoncer clairement, parce qu'elle est contre-intuitive.
     *
     * Pour un exercice de racines ou de fractions, l'analyseur ne connaît que
     * la forme `a√b` ou `n/d` : `x` n'y est pas analysable. Il est donc traité
     * comme le nom de l'inconnue — au même titre que `A` ou `G` — et la
     * réponse est le membre de droite.
     *
     * Sur un exercice d'expressions, au contraire, `x` **est** analysable :
     * les deux membres sont alors comparés, et `x = 2x + 1` est refusé parce
     * que l'égalité est fausse. Le refus dépend donc de ce que le moteur sait
     * lire, et non d'une liste de lettres interdites.
     */
    assert.equal(corriger_('MVP-B2-E1', 'x = 5√2').verdict, 'correct');
    assert.equal(corriger_('MVP-B3-E1', 'x = 1/8').verdict, 'correct');
  });
});

describe('7.7 — l’égalité ne change pas le jugement mathématique', () => {
  it('une réponse fausse reste fausse, écrite avec ou sans « = »', () => {
    const avec = corriger_('MVP-B1-E1', 'A = 4x + 1');
    const sans = corriger_('MVP-B1-E1', '4x + 1');

    assert.equal(avec.mathemathiquementJuste, false);
    assert.equal(avec.mathemathiquementJuste, sans.mathemathiquementJuste);
    assert.equal(avec.verdict, sans.verdict);
    assert.equal(avec.statut, sans.statut);
    assert.equal(avec.signatureErreur, sans.signatureErreur);
  });

  it('la catégorie de difficulté est la même avec ou sans « = »', () => {
    assert.equal(
      corriger_('MVP-B1-E1', 'A = 4x + 1').signatureErreur,
      corriger_('MVP-B1-E1', '4x + 1').signatureErreur,
    );
  });

  it('le verdict de forme est préservé à travers l’égalité', () => {
    // `A = 4x^2 - 9` sur MVP-B1-E4 : la valeur est juste, la forme ne l'est pas.
    const resultat = corriger_('MVP-B1-E4', 'A = 4x^2 - 9');
    assert.equal(resultat.verdict, 'resultat_juste_consigne_non_respectee');
  });

  it('le verdict de forme est préservé pour une racine inachevée', () => {
    const resultat = corriger_('MVP-B2-E1', 'G = √(25×2)');
    assert.equal(resultat.verdict, 'partiellement_correct');
  });

  it('une réponse sans égalité traverse la fonction inchangée', () => {
    const exercice = trouverExercice('MVP-B1-E1')!;
    assert.equal(membreReponse(exercice, '2x + 1'), '2x + 1');
    assert.equal(membreReponse(exercice, '  2x + 1  '), '  2x + 1  ');
  });
});

describe('7.7 — séparation de l’égalité', () => {
  it('ne voit rien dans une saisie ordinaire', () => {
    assert.equal(separerEgalite('2x + 1'), null);
  });

  it('sépare sur le premier « = »', () => {
    assert.deepEqual(separerEgalite('A = 2x + 1'), { gauche: 'A', droite: '2x + 1' });
  });

  it('tolère les espaces autour du signe', () => {
    assert.deepEqual(separerEgalite('  A   =   2x + 1 '), { gauche: 'A', droite: '2x + 1' });
  });

  it('normalise le moins mathématique avant de séparer', () => {
    assert.deepEqual(separerEgalite('A − 3 = 2x'), { gauche: 'A - 3', droite: '2x' });
  });
});

describe('7.7 — aucune régression sur les douze exercices', () => {
  it('la réponse attendue reste acceptée, avec et sans « = »', () => {
    for (const exercice of EXERCICES) {
      const nom = 'A';
      const direct = corriger(exercice, exercice.reponseAttendue);
      assert.equal(direct.mathemathiquementJuste, true, `${exercice.id} : réponse attendue refusée`);

      // Le membre gauche est un nom : l'égalité doit aboutir au même verdict.
      const avec = corriger(exercice, `${nom} = ${exercice.reponseAttendue}`);
      assert.equal(
        avec.mathemathiquementJuste,
        true,
        `${exercice.id} : « ${nom} = ${exercice.reponseAttendue} » refusé`,
      );
      assert.equal(avec.verdict, direct.verdict, `${exercice.id} : verdict différent avec « = »`);
    }
  });
});