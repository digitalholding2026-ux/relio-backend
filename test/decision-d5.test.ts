import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { corriger, VERDICTS, type Verdict } from '../src/contenu/correction.js';
import { EXERCICES, trouverExercice } from '../src/contenu/exercices.js';
import { estSignatureValide } from '../src/contenu/signatures.js';

/**
 * Décision D5 — arbitrage pédagogique de l'enseignant.
 *
 * Ces tests verrouillent les **quatre verdicts** et, surtout, la règle
 * centrale : *une réponse mathématiquement juste n'est jamais déclarée
 * incorrecte*, quelle que soit son écriture.
 *
 * Ils s'appuient sur les exercices réels du MVP — factorisation de `4x² − 9`,
 * racines carrées, fractions — et non sur des cas theoriques.
 *
 * Le statut technique (`correcte` / `partielle` / `fausse`) est vérifié en
 * parallèle du verdict : la règle A.3, validée avant D5, exige que
 * `partielle` ne compte ni comme juste ni comme fausse. D5 **précise** A.3,
 * il ne l'annule pas : si ces deux niveaux divergeaient, la progression
 * compterait une réponse juste comme une réussite.
 */

function corrigerExercice(id: string, reponse: string) {
  const exercice = trouverExercice(id);
  assert.ok(exercice, `${id} introuvable`);
  return corriger(exercice, reponse);
}

describe('D5 — cas D : réponse entièrement correcte', () => {
  it('reconnaît une réponse juste, achevée et conforme', () => {
    // Forme demandée respectée.
    const factorise = corrigerExercice('MVP-B1-E4', '(2x-3)(2x+3)');
    assert.equal(factorise.verdict, 'correct');
    assert.equal(factorise.mathemathiquementJuste, true);
    assert.equal(factorise.formeRespectee, true);
    assert.equal(factorise.statut, 'correcte');
    assert.equal(factorise.libelle, 'Ta réponse est juste.');

    // Forme a√b respectée.
    const racine = corrigerExercice('MVP-B2-E1', '5√2');
    assert.equal(racine.verdict, 'correct');
    assert.equal(racine.achevement, 'acheve');
    assert.equal(racine.statut, 'correcte');

    // Fraction irréductible.
    const fraction = corrigerExercice('MVP-B3-E1', '1/8');
    assert.equal(fraction.verdict, 'correct');
    assert.equal(fraction.statut, 'correcte');
  });

  it('reconnaît une réponse juste quand aucune forme n’est exigée', () => {
    // Aucun exercice B1 de développement n'impose de forme : le verdict ne
    // doit pas tomber dans « à déterminer » par défaut.
    for (const reponse of ['2x + 1', '1 + 2x', '2(x) + 1']) {
      const correction = corrigerExercice('MVP-B1-E1', reponse);
      assert.equal(correction.verdict, 'correct', `« ${reponse} »`);
      assert.equal(correction.formeRespectee, null);
    }
  });
});

describe('D5 — cas A : résultat juste, consigne non respectée', () => {
  it('signale une factorisation exacte non effectuée', () => {
    // Exemple de la décision : `4x² − 9` vaut exactement la réponse attendue,
    // mais n'est pas écrit sous forme de produit.
    const correction = corrigerExercice('MVP-B1-E4', '4x^2 - 9');

    assert.equal(correction.verdict, 'resultat_juste_consigne_non_respectee');
    assert.equal(correction.mathemathiquementJuste, true, 'Ne doit jamais être jugée fausse.');
    assert.equal(correction.formeRespectee, false);
    // Le statut technique reste `partielle` (règle A.3) : la progression ne
    // doit pas compter cette réponse comme une réussite.
    assert.equal(correction.statut, 'partielle');
    // Le message validé par l'enseignant, avec la forme à écrire.
    assert.match(correction.libelle, /mathématiquement juste/);
    assert.match(correction.libelle, /produit de facteurs du premier degré/);
  });

  it('signale une fraction exacte non réduite', () => {
    const correction = corrigerExercice('MVP-B3-E3', '24/36');
    assert.equal(correction.verdict, 'resultat_juste_consigne_non_respectee');
    assert.equal(correction.mathemathiquementJuste, true);
    assert.equal(correction.statut, 'partielle');
    assert.match(correction.libelle, /fraction irréductible/);
  });

  it('ne double pas l’article dans le message', () => {
    // Régression de formulation : « sous la forme la forme a√b » serait
    //衣柜 illisible et revealerait un message non relu.
    for (const [id, reponse] of [
      ['MVP-B1-E4', '4x^2 - 9'],
      ['MVP-B3-E1', '2/16'],
      ['MVP-B2-E1', '√50'],
    ] as ReadonlyArray<readonly [string, string]>) {
      const correction = corrigerExercice(id, reponse);
      assert.ok(
        !/la forme la forme/.test(correction.libelle),
        `${id} : article dupliqué — « ${correction.libelle} »`,
      );
      assert.match(correction.libelle, /sous la forme /, `${id} : forme attendue non nommée`);
    }
  });
});

describe('D5 — cas B : réponse partiellement correcte', () => {
  it('reconnaît un radicand décomposé en produit', () => {
    // Exemple de la décision : `√(25×2)`. L'élève a trouvé le carré parfait
    // mais n'a pas terminé l'extraction.
    const correction = corrigerExercice('MVP-B2-E1', '√(25×2)');

    assert.equal(correction.verdict, 'partiellement_correct');
    assert.equal(correction.mathemathiquementJuste, true);
    assert.equal(correction.achevement, 'inacheve');
    assert.equal(correction.statut, 'partielle', 'Ne doit compter ni juste ni fausse.');
    assert.match(correction.libelle, /partiellement correcte/);
  });

  it('distingue l’étape inachevée d’une simple erreur de forme', () => {
    // `√50` a la bonne valeur mais n'est pas décomposé : l'élève n'a pas
    // fait le chemin, alors qu'avec `√(25×2)` il l'a fait à moitié.
    const intermediaire = corrigerExercice('MVP-B2-E1', '√(25×2)');
    const nonSimplifiee = corrigerExercice('MVP-B2-E1', '√50');

    assert.equal(intermediaire.verdict, 'partiellement_correct');
    assert.equal(nonSimplifiee.verdict, 'resultat_juste_consigne_non_respectee');
    assert.notEqual(intermediaire.verdict, nonSimplifiee.verdict);
  });

  it('accepte les écritures équivalentes du même produit', () => {
    for (const reponse of ['√(2×25)', '√(5×5×2)', '√( 25 × 2 )']) {
      const correction = corrigerExercice('MVP-B2-E1', reponse);
      assert.equal(correction.verdict, 'partiellement_correct', `« ${reponse} »`);
      assert.equal(correction.achevement, 'inacheve', `« ${reponse} »`);
    }
  });

  it('ne signale pas d’achèvement quand le moteur n’a rien à observer', () => {
    // Le moteur ne prétend pas savoir qu'un développement est « fini ». Il
    // renvoie `null`, jamais `true` : le verdict reste `correct` si la valeur
    // est juste.
    for (const id of ['MVP-B1-E1', 'MVP-B1-E4', 'MVP-B3-E1']) {
      const exercice = trouverExercice(id)!;
      const correction = corriger(exercice, exercice.reponseAttendue);
      assert.equal(correction.achevement, null, `${id} : achevement inventé`);
    }
  });
});

describe('D5 — cas C : réponse incorrecte', () => {
  it('déclare incorrect une valeur fausse', () => {
    for (const [id, reponse] of [
      ['MVP-B1-E4', '(2x-4)(2x+4)'],
      ['MVP-B2-E1', '7√2'],
      ['MVP-B3-E1', '4/8'],
      ['MVP-B1-E1', '2x + 11'],
    ] as ReadonlyArray<readonly [string, string]>) {
      const correction = corrigerExercice(id, reponse);
      assert.equal(correction.verdict, 'incorrect', `${id} / « ${reponse} »`);
      assert.equal(correction.mathemathiquementJuste, false);
      assert.equal(correction.statut, 'fausse');
      assert.equal(correction.libelle, 'Ce n’est pas encore juste.');
    }
  });

  it('ne déclare jamais incorrect une réponse exacte', () => {
    // Règle cardinale de D5, vérifiée sur l'ensemble des pièges documentés :
    // si la valeur est exacte, le verdict ne peut pas être « incorrect ».
    let verifications = 0;

    for (const exercice of EXERCICES) {
      for (const piege of exercice.pieges) {
        const correction = corriger(exercice, piege.reponse);

        if (correction.mathemathiquementJuste) {
          assert.notEqual(
            correction.verdict,
            'incorrect',
            `${exercice.id} / « ${piege.reponse} » : réponse exacte déclarée incorrecte.`,
          );
          assert.notEqual(correction.statut, 'fausse', `${exercice.id} / « ${piege.reponse} »`);
        }
        verifications += 1;
      }
    }

    assert.ok(verifications >= 30, `Seulement ${verifications} pièges vérifiés.`);
  });
});

describe('D5 — équivalences algébriques', () => {
  it('reconnaît les écritures équivalentes quand la consigne le permet', () => {
    // La consigne n'exige aucune forme sur ces exercices : toute écriture
    // exacte est acceptée.
    for (const [id, reponse] of [
      ['MVP-B1-E1', '1 + 2x'],
      ['MVP-B1-E1', '2(x) + 1'],
      ['MVP-B1-E1', '2(x+0.5)'],
    ] as ReadonlyArray<readonly [string, string]>) {
      const correction = corrigerExercice(id, reponse);
      assert.equal(correction.mathemathiquementJuste, true, `${id} / « ${reponse} »`);
      assert.equal(correction.verdict, 'correct', `${id} / « ${reponse} »`);
    }
  });

  it('évalue toujours la forme séparément de la valeur', () => {
    // Anti-faux-positif exigé par le chantier : accepter toute équivalence
    // sans juger la forme viderait la consigne de son sens.
    const facteurs = corrigerExercice('MVP-B1-E4', '(2x+3)(2x-3)');
    const developpe = corrigerExercice('MVP-B1-E4', '4x^2 - 9');

    assert.equal(facteurs.mathemathiquementJuste, true);
    assert.equal(facteurs.formeRespectee, true);
    assert.equal(facteurs.verdict, 'correct');

    assert.equal(developpe.mathemathiquementJuste, true);
    assert.equal(developpe.formeRespectee, false);
    assert.equal(developpe.verdict, 'resultat_juste_consigne_non_respectee');
  });

  it('reconnaît une équivalence de racine comme non simplifiée', () => {
    // `√50` et `√(50)` valent exactement `5√2`, mais ne sont pas écrits sous
    // la forme demandée.
    //
    // `10√2` n'est volontairement pas dans cette liste : il vaut `2 × 5√2`,
    // donc c'est bien une réponse fausse (cas C), et le moteur doit le dire.
    for (const reponse of ['√50', '√(50)']) {
      const correction = corrigerExercice('MVP-B2-E1', reponse);
      assert.equal(correction.mathemathiquementJuste, true, `« ${reponse} »`);
      assert.equal(correction.formeRespectee, false, `« ${reponse} »`);
      assert.equal(correction.verdict, 'resultat_juste_consigne_non_respectee', `« ${reponse} »`);
    }

    // Le coefficient reste vérifié : c'est la seule chose qui distingue les
    // deux écritures.
    const faux = corrigerExercice('MVP-B2-E1', '10√2');
    assert.equal(faux.mathemathiquementJuste, false);
    assert.equal(faux.verdict, 'incorrect');
  });
});

describe('D5 — prudence : ce que le moteur ne peut pas déterminer', () => {
  it('ne fabrique pas de verdict quand la forme est indéterminable', () => {
    // `regleFormeArbitree === false` : aucune règle de forme n'est arbitrée.
    // Le moteur doit reconnaître son ignorance, pas conclure.
    const exercice = trouverExercice('MVP-B1-E1')!;
    const sansRegle = { ...exercice, regleForme: 'produit_de_facteurs' as const, regleFormeArbitree: false };

    const correction = corriger(sansRegle, '2x + 1');
    assert.equal(correction.verdict, 'a_determiner');
    assert.equal(correction.mathemathiquementJuste, true);
    assert.match(correction.libelle, /ton enseignant/);
  });

  it('signale l’incertitude quand une règle de forme n’est pas arbitrée', () => {
    const exercice = trouverExercice('MVP-B1-E4')!;
    const sansRegle = { ...exercice, regleFormeArbitree: false };

    const correction = corriger(sansRegle, '4x^2 - 9');
    assert.equal(correction.verdict, 'a_determiner');
    assert.equal(correction.lectureArbitree, false);
    assert.ok(correction.pointsArbitrage.includes('forme-non-arbitree'));
  });

  it('refuse une saisie qu’il ne sait pas interpréter, sans verdict', () => {
    // Le moteur ne devine jamais : une saisie hors grammaire est refusée,
    // et ne produit ni « incorrect » ni « à déterminer ».
    for (const saisie of ['√(25+2)', '√(x×2)', '√(2*3*5*7*11)', '√(1e3)']) {
      assert.throws(
        () => corrigerExercice('MVP-B2-E1', saisie),
        `« ${saisie} » aurait dû être refusée`,
      );
    }
  });
});

describe('D5 — invariants du moteur', () => {
  it('ne produit que des verdicts du vocabulaire fermé', () => {
    for (const exercice of EXERCICES) {
      const entrees = [
        exercice.reponseAttendue,
        ...exercice.pieges.map((p) => p.reponse),
      ];

      for (const saisie of entrees) {
        const correction = corriger(exercice, saisie);
        assert.ok(
          (VERDICTS as readonly string[]).includes(correction.verdict),
          `${exercice.id} / « ${saisie} » : verdict hors vocabulaire — ${correction.verdict}`,
        );
        assert.ok(correction.libelle.length > 0, `${exercice.id} : libellé vide`);
      }
    }
  });

  it('donne un libellé distinct à chaque verdict pedagogical', () => {
    const vus = new Map<Verdict, string>();

    for (const [id, reponse] of [
      ['MVP-B1-E4', '(2x-3)(2x+3)'],
      ['MVP-B1-E4', '4x^2 - 9'],
      ['MVP-B2-E1', '√(25×2)'],
      ['MVP-B2-E1', '7√2'],
    ] as ReadonlyArray<readonly [string, string]>) {
      const { verdict, libelle } = corrigerExercice(id, reponse);
      const precedent = vus.get(verdict);
      assert.ok(
        precedent === undefined || precedent === libelle,
        `Verdict ${verdict} : deux libellés différents.`,
      );
      vus.set(verdict, libelle);
    }

    assert.equal(vus.size, 4, `Quatre verdicts attendus, ${vus.size} observés.`);
  });

  it('conserve la règle A.3 : `partielle` ne compte ni juste ni fausse', () => {
    // D5 sépare deux verdicts que A.3 regroupait. La garantie d'A.3 doit
    // survivre : les deux cas restent `partielle` côté progression.
    for (const [id, reponse] of [
      ['MVP-B1-E4', '4x^2 - 9'],
      ['MVP-B3-E3', '24/36'],
      ['MVP-B2-E1', '√(25×2)'],
    ] as ReadonlyArray<readonly [string, string]>) {
      const correction = corrigerExercice(id, reponse);
      assert.equal(correction.statut, 'partielle', `${id} / « ${reponse} »`);
      assert.notEqual(correction.statut, 'correcte');
      assert.notEqual(correction.statut, 'fausse');
    }
  });

  it('préserve les indices et la protection des blocs', () => {
    // Non-régression : la décision D5 ne touche ni aux indices ni aux
    // garde-fous calendaires.
    const avecIndice = corrigerExercice('MVP-B1-E4', '(2x-3)(2x+3)');
    assert.equal(avecIndice.indice, null, 'Aucun indice demandé.');

    const avecPalier = corriger(trouverExercice('MVP-B1-E4')!, '(2x-3)(2x+3)', 2);
    assert.equal(avecPalier.indice, 2);
    assert.equal(avecPalier.verdict, 'correct');
  });

  it('ne fuit toujours pas la réponse attendue dans le verdict', () => {
    for (const exercice of EXERCICES) {
      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        const correction = corriger(exercice, saisie);
        const serialise = JSON.stringify({
          verdict: correction.verdict,
          libelle: correction.libelle,
          explication: correction.explication,
        });
        assert.ok(
          !serialise.includes(exercice.reponseAttendue),
          `${exercice.id} : la réponse attendue fuit.`,
        );
      }
    }
  });

  it('conserve un catalogue de signatures fermé', () => {
    for (const exercice of EXERCICES) {
      for (const piege of exercice.pieges) {
        const correction = corriger(exercice, piege.reponse);
        assert.ok(
          estSignatureValide(correction.signatureErreur),
          `${exercice.id} : signature hors catalogue.`,
        );
      }
    }
  });
});
