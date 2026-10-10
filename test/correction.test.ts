import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { corriger, formeDemandee, messagePourErreur, type FormeVerdict } from '../src/contenu/correction.js';
import { EXERCICES, trouverExercice } from '../src/contenu/exercices.js';
import { estSignatureValide, SIGNATURE_PAR_DEFAUT } from '../src/contenu/signatures.js';

/**
 * Tests de la correction — le cœur du chantier 7.
 *
 * Règle que ces tests défendent : **une réponse n'est jamais déclarée
 * mathématiquement fausse au motif qu'elle est écrite différemment**. La forme
 * et la valeur sont deux jugements, et le premier ne dépend pas du second.
 */

function corrigerExercice(id: string, reponse: string) {
  const exercice = trouverExercice(id);
  assert.ok(exercice, `${id} introuvable`);
  return corriger(exercice, reponse);
}

/** Une réponse fausse pour chaque exercice, de façon à tester l'explication. */
const REPONSES_FAUSSES: Readonly<Record<string, string>> = {
  'MVP-B1-E1': '4x + 1',
  'MVP-B1-E2': '4x^2 + 4x + 1',
  'MVP-B1-E3': 'x^2 - x - 8',
  'MVP-B1-E4': '(2x-4)(2x+4)',
  'MVP-B1-E5': 'x(x+7)',
  'MVP-B1-E6': '(3x+1)(x-2)',
  'MVP-B2-E1': '50√2',
  'MVP-B2-E2': '9√3',
  'MVP-B2-E3': '9√2',
  'MVP-B3-E1': '4/8',
  'MVP-B3-E2': '12/15',
  'MVP-B3-E3': '11/13',
};

describe('axe 1 — justesse mathématique', () => {
  it('accepte les écritures algébriquement équivalentes', () => {
    // Réponses écrites autrement que la réponse attendue, mais identiques.
    assert.equal(corrigerExercice('MVP-B1-E1', '1 + 2x').mathemathiquementJuste, true);
    assert.equal(corrigerExercice('MVP-B1-E2', '1 - 4x + 4x^2').mathemathiquementJuste, true);
    assert.equal(corrigerExercice('MVP-B1-E3', 'x*x - x - 4').mathemathiquementJuste, true);
    assert.equal(corrigerExercice('MVP-B1-E4', '(2x+3)(2x-3)').mathemathiquementJuste, true);
    assert.equal(corrigerExercice('MVP-B1-E5', 'x^2 - 7x').mathemathiquementJuste, true);
    assert.equal(corrigerExercice('MVP-B1-E6', '(x+2)(3x-1)').mathemathiquementJuste, true);
  });

  it('accepte les écritures de racines équivalentes', () => {
    // √50 vaut exactement 5√2 : même valeur, écriture non simplifiée.
    assert.equal(corrigerExercice('MVP-B2-E1', '√50').mathemathiquementJuste, true);
    // √27 vaut exactement 3√3.
    assert.equal(corrigerExercice('MVP-B2-E2', '√27').mathemathiquementJuste, true);
    // 1√2 est l'écriture de √2.
    assert.equal(corrigerExercice('MVP-B2-E3', '1√2').mathemathiquementJuste, true);
  });

  it('accepte une fraction équivalente non demandée sous cette forme', () => {
    // 24/36 = 2/3 : juste mathématiquement, mais pas la forme demandée.
    const correction = corrigerExercice('MVP-B3-E3', '24/36');
    assert.equal(correction.mathemathiquementJuste, true);
  });

  it('refuse une valeur réellement différente', () => {
    assert.equal(corrigerExercice('MVP-B1-E1', '2x + 11').mathemathiquementJuste, false);
    assert.equal(corrigerExercice('MVP-B2-E1', '50√2').mathemathiquementJuste, false);
    assert.equal(corrigerExercice('MVP-B2-E1', '5√3').mathemathiquementJuste, false);
    assert.equal(corrigerExercice('MVP-B3-E1', '4/8').mathemathiquementJuste, false);
  });

  it('ne déclare jamais fausse une réponse exacte écrite autrement', () => {
    // Cas de non-régression le plus important du chantier : toute écriture
    // portant **la valeur exacte** doit rester juste mathématiquement, quelle
    // que soit sa forme. Seul le second axe peut être en défaut.
    const CAS: ReadonlyArray<readonly [string, string]> = [
      ['MVP-B1-E1', '1 + 2x'],
      ['MVP-B1-E1', '2(x) + 1'],
      ['MVP-B1-E1', '2(x+0.5)'], // coefficient fractionnaire
      ['MVP-B1-E4', '16x^2/4 - 9'], // coefficients divisés par des constantes
      ['MVP-B1-E4', '(2x+3)(2x-3)'], // facteurs inversés
      ['MVP-B1-E4', '4(x-1.5)(x+1.5)'], // constante fractionnaire
      ['MVP-B1-E4', '4x^2 - 9'], // valeur exacte, forme non demandée
      ['MVP-B3-E1', '2/16'], // fraction non irréductible
      ['MVP-B3-E1', '0.125'], // même valeur, écriture décimale
      ['MVP-B3-E3', '24/36'],
      ['MVP-B2-E1', '√50'], // valeur exacte, non simplifiée
      ['MVP-B2-E1', '√(50)'], // même valeur, parenthèses acceptées
    ];

    for (const [id, reponse] of CAS) {
      const correction = corrigerExercice(id, reponse);
      assert.equal(
        correction.mathemathiquementJuste,
        true,
        `${id} / « ${reponse} » : valeur exacte déclarée fausse.`,
      );
      assert.notEqual(
        correction.statut,
        'fausse',
        `${id} / « ${reponse} » : une réponse exacte ne peut pas être fausse.`,
      );
    }
  });

  it('sépare toujours les deux axes sur une réponse exacte mal formée', () => {
    // Le même couple (valeur exacte, forme non respectée) doit produire le
    // statut « partielle » et le dire explicitement : l'élève a raison sur le
    // fond, et doit le voir.
    for (const [id, reponse] of [
      ['MVP-B1-E4', '4x^2 - 9'],
      ['MVP-B3-E1', '2/16'],
      ['MVP-B3-E3', '24/36'],
      ['MVP-B2-E1', '√50'],
    ] as ReadonlyArray<readonly [string, string]>) {
      const correction = corrigerExercice(id, reponse);
      assert.equal(correction.mathemathiquementJuste, true, `${id} / ${reponse}`);
      assert.equal(correction.formeRespectee, false, `${id} / ${reponse}`);
      assert.equal(correction.statut, 'partielle', `${id} / ${reponse}`);
      // La forme est signalée comme non arbitrée : le client ne présente
      // jamais ce cas comme une conclusion ferme.
      assert.equal(correction.lectureArbitree, false, `${id} / ${reponse}`);
    }
  });
});

describe('axe 2 — respect de la forme demandée', () => {
  it('distingue la forme irréductible', () => {
    assert.equal(corrigerExercice('MVP-B3-E1', '1/8').formeRespectee, true);
    assert.equal(corrigerExercice('MVP-B3-E1', '24/36').formeRespectee, false);
    // Une décimale n'est pas une fraction irréductible, même si la valeur
    // est exactement la même.
    assert.equal(corrigerExercice('MVP-B3-E3', '0.666666').formeRespectee, false);
  });

  it('distingue la forme factorisée', () => {
    assert.equal(corrigerExercice('MVP-B1-E4', '(2x-3)(2x+3)').formeRespectee, true);
    assert.equal(corrigerExercice('MVP-B1-E4', '(3-2x)(-2x-3)').formeRespectee, true);
    assert.equal(corrigerExercice('MVP-B1-E4', '4x^2 - 9').formeRespectee, false);
    assert.equal(corrigerExercice('MVP-B1-E5', 'x^2 - 7x').formeRespectee, false);
  });

  it('distingue la forme a√b', () => {
    assert.equal(corrigerExercice('MVP-B2-E1', '5√2').formeRespectee, true);
    // √50 a exactement la bonne valeur, mais n'est pas « simplifié ».
    const nonSimplifie = corrigerExercice('MVP-B2-E1', '√50');
    assert.equal(nonSimplifie.mathemathiquementJuste, true);
    assert.equal(nonSimplifie.formeRespectee, false);
    assert.equal(nonSimplifie.statut, 'partielle');
  });

  it('ne juge pas la forme quand aucune forme n’est demandée', () => {
    for (const reponse of ['2x + 1', '1 + 2x', '2(x+0.5)']) {
      const correction = corrigerExercice('MVP-B1-E1', reponse);
      if (correction.mathemathiquementJuste) {
        assert.equal(correction.formeRespectee, null, 'Forme jugée alors qu’aucune n’est exigée.');
        assert.equal(correction.forme, 'indeterminee');
      }
    }
  });
});

describe('axe 3 — statut d’interprétation', () => {
  it('« correcte » quand la valeur et la forme conviennent', () => {
    const correction = corrigerExercice('MVP-B1-E1', '2x + 1');
    assert.equal(correction.statut, 'correcte');
    assert.equal(correction.lectureArbitree, true);
  });

  it('« partielle » quand la valeur est juste mais la forme manque', () => {
    // ── Le cas dégénéré du chantier 6 (F1) ──────────────────────────────
    const fraction = corrigerExercice('MVP-B3-E3', '24/36');
    assert.equal(fraction.mathemathiquementJuste, true);
    assert.equal(fraction.formeRespectee, false);
    assert.equal(fraction.statut, 'partielle');
    assert.equal(fraction.signatureErreur, 'denominateur_non_reduit');
    // Le point non arbitré est signalé, jamais présenté comme tranché.
    assert.equal(fraction.lectureArbitree, false);
    assert.ok(fraction.pointsArbitrage.includes('lecture-partielle-a3'));

    const factorisation = corrigerExercice('MVP-B1-E4', '4x^2 - 9');
    assert.equal(factorisation.mathemathiquementJuste, true);
    assert.equal(factorisation.statut, 'partielle');
    assert.equal(factorisation.signatureErreur, 'non_factorise');
  });

  it('« fausse » quand la valeur est fausse, sans jamais mixer les axes', () => {
    const correction = corrigerExercice('MVP-B1-E4', '(2x-4)(2x+4)');
    assert.equal(correction.mathemathiquementJuste, false);
    assert.equal(correction.statut, 'fausse');
    assert.equal(correction.signatureErreur, 'signe_inverse_dans_difference_carre');
    // La forme, elle, est bien respectée : les deux jugements sont distincts.
    assert.equal(correction.formeRespectee, true);
  });

  it('ne traite jamais à tort une réponse correcte', () => {
    for (const exercice of EXERCICES) {
      for (const piege of exercice.pieges) {
        const correction = corriger(exercice, piege.reponse);
        // Invariant central : une réponse dont la valeur est juste ne peut
        // jamais être classée « fausse », quelle que soit son écriture.
        if (correction.mathemathiquementJuste) {
          assert.notEqual(correction.statut, 'fausse', `${exercice.id} / ${piege.reponse}`);
          assert.equal(correction.statut, 'partielle', `${exercice.id} / ${piege.reponse}`);
        }
      }
    }
  });
});

describe('signatures d’erreur', () => {
  it('rattache chaque piège d’erreur à sa signature', () => {
    let verifications = 0;

    for (const exercice of EXERCICES) {
      for (const piege of exercice.pieges) {
        const correction = corriger(exercice, piege.reponse);
        assert.equal(correction.signatureErreur, piege.signature, `${exercice.id} / ${piege.reponse}`);

        // Certains pièges documentent le cas « valeur exacte, forme non
        // respectée » (24/36, 4x² − 9, x² − 7x…). Ils sont justes au sens
        // algébrique et doivent produire « partielle », jamais « fausse ».
        if (correction.mathemathiquementJuste) {
          assert.equal(correction.statut, 'partielle', `${exercice.id} / ${piege.reponse}`);
          assert.equal(correction.formeRespectee, false, `${exercice.id} / ${piege.reponse}`);
        } else {
          assert.equal(correction.statut, 'fausse', `${exercice.id} / ${piege.reponse}`);
        }
        assert.ok(estSignatureValide(correction.signatureErreur));
        verifications += 1;
      }
    }

    assert.ok(verifications >= 30, `Seulement ${verifications} pièges vérifiés.`);
  });

  it('retombe sur hors_perimetre quand rien ne correspond', () => {
    const correction = corrigerExercice('MVP-B1-E1', '999x + 999');
    assert.equal(correction.statut, 'fausse');
    assert.equal(correction.signatureErreur, SIGNATURE_PAR_DEFAUT);
    // Aucune conclusion spécifique n'est tirée d'une erreur inconnue.
    assert.match(correction.explication, /Reprends la méthode/);
  });

  it('renseigne toujours une explication utile', () => {
    for (const exercice of EXERCICES) {
      const juste = corriger(exercice, exercice.reponseAttendue);
      assert.ok(juste.explication.length > 10, `${exercice.id} : explication absente`);

      const fausse = corriger(exercice, REPONSES_FAUSSES[exercice.id] ?? '');
      assert.equal(fausse.statut, 'fausse');
      assert.ok(fausse.explication.length > 10, `${exercice.id} : explication absente`);
    }
  });
});

describe('robustesse et garde-fous', () => {
  it('refuse une saisie illisible sans rien divulguer', () => {
    for (const illisible of ['', '   ', 'abc', 'x/x', '3√-4']) {
      assert.throws(() => corrigerExercice('MVP-B3-E1', illisible));
    }
    const message = messagePourErreur(new Error('fuite technique interne'));
    assert.equal(message, 'Réponse illisible. Réessaie.');
  });

  it('ne laisse fuir aucune réponse attendue dans le verdict', () => {
    for (const exercice of EXERCICES) {
      const verdict = corriger(exercice, REPONSES_FAUSSES[exercice.id] ?? '');
      const serialise = JSON.stringify({
        mathemathiquementJuste: verdict.mathemathiquementJuste,
        formeRespectee: verdict.formeRespectee,
        statut: verdict.statut,
        signatureErreur: verdict.signatureErreur,
        explication: verdict.explication,
      });
      assert.ok(
        !serialise.includes(exercice.reponseAttendue),
        `${exercice.id} : la réponse attendue fuit dans le verdict.`,
      );
    }
  });

  it('respecte un exposant absurde sans planter', () => {
    assert.throws(() => corrigerExercice('MVP-B1-E2', 'x^99999'));
  });

  it('expose la forme demandée en clair pour l’interface', () => {
    assert.equal(formeDemandee(trouverExercice('MVP-B3-E1')!), 'une fraction irréductible');
    assert.equal(
      formeDemandee(trouverExercice('MVP-B1-E4')!),
      'un produit de facteurs du premier degré',
    );
    assert.equal(formeDemandee(trouverExercice('MVP-B1-E1')!), null);
  });

  it('ne laisse aucun piège dans un statut indéterminé', () => {
    for (const exercice of EXERCICES) {
      for (const piege of exercice.pieges) {
        const verdict = corriger(exercice, piege.reponse);
        assert.notEqual(verdict.statut, 'indeterminee', `${exercice.id} / ${piege.reponse}`);
        assert.ok(['fausse', 'partielle'].includes(verdict.statut));
      }
    }
  });

  it('plafonne le nombre d’indices rendus', () => {
    const exercice = trouverExercice('MVP-B1-E1')!;
    assert.equal(corriger(exercice, '2x + 1', 0).indice, null);
    assert.equal(corriger(exercice, '2x + 1', 1).indice, 1);
    assert.equal(corriger(exercice, '2x + 1', 3).indice, 3);
    assert.equal(corriger(exercice, '2x + 1', 99).indice, 3);
  });
});