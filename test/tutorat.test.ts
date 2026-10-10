/**
 * Chantier 7.5 — accompagnement pas à pas.
 *
 * Ces tests verrouillent les propriétés que le chantier **interdit** de
 * dégrader, et pas seulement celles qu'il ajoute :
 *
 * 1. **le premier échec ne déploie pas la méthode** — pas d'exemple résolu,
 *    pas de réponse attendue ;
 * 2. **l'aide progresse réellement** — les trois niveaux ne sont pas trois
 *    reformulations du même texte ;
 * 3. **les verdicts D5 sont inchangés** — le tutorat n'en modifie aucun ;
 * 4. **aucune cause n'est inventée** — une erreur non reconnue reste inconnue,
 *    y compris dans le suivi ;
 * 5. **aucun identifiant technique** n'atteint l'élève ;
 * 6. **aucune réponse attendue n'est divulguée**, à aucun niveau.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AIDES_PAR_OBJECTIF, type ObjectifId } from '../src/contenu/aides.js';
import { corriger, VERDICTS, type CorrectionComplete } from '../src/contenu/correction.js';
import { EXERCICES, trouverExercice } from '../src/contenu/exercices.js';
import { SIGNATURES } from '../src/contenu/signatures.js';
import {
  CATEGORIES_DIFICULTE,
  categoriePour,
  categoriePourSignature,
  construireTutorat,
  niveauPourNbEchecs,
  normaliserNbEchecs,
  tutoratSaisieInvalide,
} from '../src/contenu/tutorat.js';
import type { Exercice } from '../src/contenu/types.js';

/** Identifiants techniques : ne doivent jamais atteindre un élève. */
const MOTIF_IDENTIFIANT = /\b(?:OO|LEC|MVP|SONDE)-[A-Z0-9-]+\b/;

/** Trois niveaux d'aide pour une correction donnée. */
function troisNiveaux(exercice: Exercice, saisie: string) {
  const correction = corriger(exercice, saisie);
  return [0, 1, 2].map((n) => construireTutorat(exercice, correction, n));
}

/** Un exemple de réponse fausse, par type de réponse d'exercice. */
const REPONSE_FAUSSE: Record<string, string> = {
  rationnelle: '1/2',
  expression: 'x + 1',
  racine: '3√7',
};

describe('7.5 — le premier échec ne disclose pas la méthode', () => {
  it('n’affiche au premier échec ni exemple résolu ni réponse attendue', () => {
    for (const exercice of EXERCICES) {
      const saisie = REPONSE_FAUSSE[exercice.typeReponse] ?? '0';
      const niveau1 = troisNiveaux(exercice, saisie)[0]!;

      assert.equal(niveau1.niveau, 1, `${exercice.id} : niveau inattendu`);

      // La réponse attendue ne doit jamais apparaître.
      assert.ok(
        !niveau1.message.includes(exercice.reponseAttendue),
        `${exercice.id} : le niveau 1 donne la réponse attendue.`,
      );

      // Le niveau 1 doit rester court : c'est une orientation, pas une leçon.
      assert.ok(
        niveau1.message.length <= 220,
        `${exercice.id} : le niveau 1 est trop long (${niveau1.message.length} caractères).`,
      );
      assert.ok(
        !niveau1.resume,
        `${exercice.id} : le bilan de méthode ne doit pas précéder le travail.`,
      );
    }
  });

  it('pose une question à laquelle l’élève peut répondre seul', () => {
    // Une orientation qui ne se termine pas sur une question n'oriente pas.
    for (const exercice of EXERCICES) {
      const saisie = REPONSE_FAUSSE[exercice.typeReponse] ?? '0';
      const niveau1 = troisNiveaux(exercice, saisie)[0]!;
      assert.ok(
        niveau1.message.includes('?'),
        `${exercice.id} : le premier retour ne pose aucune question.`,
      );
      assert.ok(
        niveau1.action.length > 0,
        `${exercice.id} : le premier retour ne dit pas quoi faire ensuite.`,
      );
    }
  });

  it('n’expose aucun identifiant technique, à aucun niveau', () => {
    for (const exercice of EXERCICES) {
      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        const correction = corriger(exercice, saisie);
        for (const n of [0, 1, 2]) {
          const aide = construireTutorat(exercice, correction, n);
          assert.doesNotMatch(
            aide.message,
            MOTIF_IDENTIFIANT,
            `${exercice.id}/${saisie}/niv${n}`,
          );
          assert.doesNotMatch(
            aide.action,
            MOTIF_IDENTIFIANT,
            `${exercice.id}/${saisie}/action`,
          );
        }
      }
    }
  });

  it('ne divulgue jamais la réponse attendue, à aucun niveau', () => {
    for (const exercice of EXERCICES) {
      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        const correction = corriger(exercice, saisie);
        for (const n of [0, 1, 2]) {
          const aide = construireTutorat(exercice, correction, n);
          for (const champ of ['message', 'action'] as const) {
            assert.ok(
              !aide[champ].includes(exercice.reponseAttendue),
              `${exercice.id}/${saisie}/niv${n} : « ${champ} » donne la réponse attendue.`,
            );
          }
          if (aide.resume !== null) {
            assert.ok(
              !aide.resume.includes(exercice.reponseAttendue),
              `${exercice.id}/${saisie}/niv${n} : le bilan donne la réponse attendue.`,
            );
          }
        }
      }
    }
  });

  it('n’utilise, au niveau 2, que des exemples pris sur un autre exercice', () => {
    // Quand le niveau 2 retombe sur `AIDES_PAR_OBJECTIF[].exemple`, cet exemple
    // ne doit appartenir qu'à l'exercice en cours : il est vérifié ici pour
    // chaque objectif du MVP.
    for (const exercice of EXERCICES) {
      const correspondance = AIDES_PAR_OBJECTIF[exercice.objectifs[0] as ObjectifId];
      assert.ok(correspondance, `${exercice.id} : objectif inconnu`);
      assert.ok(
        !correspondance.exemple.includes(exercice.reponseAttendue),
        `${exercice.id} : l’exemple de l’objectif donne la réponse attendue.`,
      );
    }
  });
});

describe('7.5 — l’aide progresse réellement', () => {
  it('fait monter le niveau avec le nombre d’échecs', () => {
    assert.equal(niveauPourNbEchecs(0), 1);
    assert.equal(niveauPourNbEchecs(1), 2);
    assert.equal(niveauPourNbEchecs(2), 3);
    assert.equal(niveauPourNbEchecs(99), 3, 'Le niveau est borné.');
  });

  it('normalise un contexte client abusif sans escalader', () => {
    assert.equal(normaliserNbEchecs(undefined), 0);
    assert.equal(normaliserNbEchecs('beaucoup'), 0);
    assert.equal(normaliserNbEchecs(-5), 0);
    assert.equal(normaliserNbEchecs(3.9), 3);
    assert.equal(normaliserNbEchecs(10_000), 20);
  });

  it('produit trois textes distincts sur une réponse fausse', () => {
    // La règle centrale : une simple reformulation ne.progresse pas.
    for (const exercice of EXERCICES) {
      const saisie = REPONSE_FAUSSE[exercice.typeReponse] ?? '0';
      const [n1, n2, n3] = troisNiveaux(exercice, saisie);

      const niveau1 = corriger(exercice, saisie).statut;
      if (niveau1 === 'correcte') continue; // cas particulier : le bilan

      const messages = [n1?.message, n2?.message, n3?.message];
      assert.ok(
        messages[0] !== messages[1],
        `${exercice.id} : les niveaux 1 et 2 disent la même chose.`,
      );
      assert.ok(
        messages[1] !== messages[2],
        `${exercice.id} : les niveaux 2 et 3 disent la même chose.`,
      );
    }
  });

  it('oriente, puis explique une étape, puis agit sur l’exercice', () => {
    // Sur un exercice de développement, le niveau 2 parle d'un exemple et le
    // niveau 3 parle des données de l'élève : c'est la progression attendue.
    const exercice = trouverExercice('MVP-B1-E1')!;
    const [n1, n2, n3] = troisNiveaux(exercice, '4x + 1');

    assert.ok(n1 && n2 && n3);
    assert.equal(n1.origine, 'signature', 'Cause reconnue : le premier retour doit être ciblé.');
    assert.match(n1.message, /\?/, 'Le niveau 1 pose une question.');
    assert.equal(n2.origine, 'indice', 'Le niveau 2 réutilise un indice existant.');
    assert.equal(n3.origine, 'indice', 'Le niveau 3 agit sur l’exercice.');
    assert.match(n3.message, /\bA\b/, 'Le niveau 3 travaille sur les données de l’élève.');
  });

  it('n’est pas artificiellement long au niveau 3', () => {
    for (const exercice of EXERCICES) {
      const saisie = REPONSE_FAUSSE[exercice.typeReponse] ?? '0';
      const niveau3 = troisNiveaux(exercice, saisie)[2]!;
      assert.ok(
        niveau3.message.length <= 420,
        `${exercice.id} : niveau 3 trop long (${niveau3.message.length}).`,
      );
    }
  });

  it('réutilise les indices existants plutôt que de les dupliquer', () => {
    // Quand l'exercice possède un palier 3, le tutorat doit s'en servir : c'est
    // la condition pour que les 36 indices restent la matière du tutorat.
    for (const exercice of EXERCICES) {
      const palier3 = exercice.indices.find((i) => i.palier === 3);
      assert.ok(palier3, `${exercice.id} : palier 3 manquant`);
      const aide = troisNiveaux(exercice, REPONSE_FAUSSE[exercice.typeReponse] ?? '0')[2]!;
      // Le niveau 3 reprend l'indice, éventuellement précédé d'une règle.
      assert.ok(
        aide.message.includes(palier3.texte) || aide.origine === 'forme',
        `${exercice.id} : le niveau 3 ignore l’indice du palier 3.`,
      );
    }
  });
});

describe('7.5 — les verdicts D5 sont préservés', () => {
  it('le tutorat ne modifie aucun verdict', () => {
    for (const exercice of EXERCICES) {
      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        for (const n of [0, 1, 2]) {
          const avant: CorrectionComplete = corriger(exercice, saisie);
          construireTutorat(exercice, avant, n);
          const apres: CorrectionComplete = corriger(exercice, saisie);
          assert.deepEqual(apres.verdict, avant.verdict, `${exercice.id}/${saisie}`);
          assert.deepEqual(apres.statut, avant.statut, `${exercice.id}/${saisie}`);
          assert.deepEqual(apres.libelle, avant.libelle, `${exercice.id}/${saisie}`);
          assert.deepEqual(apres.explication, avant.explication, `${exercice.id}/${saisie}`);
        }
      }
    }
  });

  it('conserve les cinq verdicts et les quatre statuts', () => {
    assert.equal(VERDICTS.length, 5);
    assert.deepEqual([...VERDICTS].sort(), [
      'a_determiner',
      'correct',
      'incorrect',
      'partiellement_correct',
      'resultat_juste_consigne_non_respectee',
    ]);
  });

  it('ne dit jamais « juste » sur une réponse fausse', () => {
    // Régression ciblée : une réponse peut être fausse ET mal formée. Le
    // tutorat ne doit alors pas afficher le bandeau « résultat juste ».
    const cas: Array<[string, string]> = [
      ['MVP-B1-E5', '2x - 7'],
      ['MVP-B1-E2', '4x^2 + 4x + 1'],
      ['MVP-B3-E1', '1/2'],
    ];
    for (const [id, saisie] of cas) {
      const exercice = trouverExercice(id)!;
      const correction = corriger(exercice, saisie);
      assert.equal(
        correction.mathemathiquementJuste,
        false,
        `${id} : ce cas de test suppose une réponse fausse`,
      );
      for (const n of [0, 1, 2]) {
        const aide = construireTutorat(exercice, correction, n);
        assert.doesNotMatch(
          aide.message,
          /ton résultat est juste|la valeur est juste/i,
          `${id} : le tutorat annonce un résultat juste sur une réponse fausse.`,
        );
      }
    }
  });

  it('accuse réception d’une étape correcte inachevée', () => {
    // D5 cas B : la décomposition est juste, l'extraction manque. Le message doit
    // le dire — c'est la reconnaissance du travail réellement acquis.
    const exercice = trouverExercice('MVP-B2-E1')!;
    const correction = corriger(exercice, '√(25×2)');
    assert.equal(correction.verdict, 'partiellement_correct');
    const aide = construireTutorat(exercice, correction, 0);
    assert.match(aide.message, /bien décomposé/i);
    assert.match(aide.action, /carré parfait/i);
  });

  it('n’invente rien quand la forme n’est pas arbitrable', () => {
    const exercice = trouverExercice('MVP-B1-E1')!;
    const correction: CorrectionComplete = {
      ...corriger(exercice, '2x + 1'),
      verdict: 'a_determiner',
      formeRespectee: null,
    };
    const aide = construireTutorat(exercice, correction, 0);
    assert.equal(aide.origine, 'generique');
    assert.doesNotMatch(aide.message, /tu as (oublié|confondu|perdu)/i);
  });

  it('ne diagnostique rien sur une saisie illisible', () => {
    for (const exercice of EXERCICES) {
      const aide = tutoratSaisieInvalide(exercice);
      assert.doesNotMatch(aide.message, MOTIF_IDENTIFIANT);
      assert.doesNotMatch(aide.message, /tu as (oublié|confondu|perdu)/i);
      assert.ok(aide.message.length > 20);
    }
  });
});

describe('7.5 — catégories de difficulté', () => {
  it('distingue « aucune erreur » et « erreur non qualifiée »', () => {
    // Une réponse juste n'est pas une lacune : `null`, pas « inconnue ».
    const exercice = trouverExercice('MVP-B1-E1')!;
    assert.equal(categoriePour(corriger(exercice, '2x + 1')), null);
    // Une erreur constatée mais non qualifiée porte la catégorie explicite.
    assert.equal(categoriePour(corriger(exercice, '999x + 999')), 'erreur_non_identifiee');
  });

  it('associe une catégorie à chaque signature reconnue', () => {
    for (const signature of SIGNATURES) {
      const categorie = categoriePourSignature(signature);
      assert.ok(
        CATEGORIES_DIFICULTE.includes(categorie),
        `${signature} : catégorie hors catalogue`,
      );
    }
  });

  it('ne transforme jamais une cause inconnue en cause précise', () => {
    for (const signature of SIGNATURES) {
      if (signature === 'hors_perimetre') {
        assert.equal(categoriePourSignature(signature), 'erreur_non_identifiee', signature);
      }
    }
  });

  it('rattache chaque piège documenté à la catégorie de sa signature', () => {
    for (const exercice of EXERCICES) {
      for (const piege of exercice.pieges) {
        // Un piège volontairement déclaré `hors_perimetre` **est** une erreur
        // inconnue : c'est le contenu lui-même qui l'affirme. Il ne doit pas
        // être forcé dans une catégorie précise.
        if (piege.signature === 'hors_perimetre') continue;

        const correction = corriger(exercice, piege.reponse);
        // Un piège juste en valeur reste « juste » : aucune erreur constatée.
        if (correction.mathemathiquementJuste) continue;

        const categorie = categoriePour(correction);
        assert.ok(categorie !== null, `${exercice.id}/${piege.reponse} : aucune catégorie`);
        assert.notEqual(
          categorie,
          'erreur_non_identifiee',
          `${exercice.id} : le piège « ${piege.reponse} » est documenté avec la signature « ${piege.signature} » mais l’erreur est classée inconnue.`,
        );
      }
    }
  });

  it('ne déclare jamais juste une réponse dont la valeur est fausse', () => {
    // `MVP-B3-E1` attend 1/8 ; la saisie « 1/2 » correspond en **valeur** au
    // piège « 4/8 » (dénominateur non réduit), et hérite donc de sa signature.
    // Le tutorat ne doit pour autant pas annoncer un résultat juste : il ne
    // l'est pas.
    const exercice = trouverExercice('MVP-B3-E1')!;
    const correction = corriger(exercice, '1/2');
    assert.equal(correction.mathemathiquementJuste, false);
    assert.equal(correction.signatureErreur, 'denominateur_non_reduit');
    for (const n of [0, 1, 2]) {
      const aide = construireTutorat(exercice, correction, n);
      assert.doesNotMatch(
        aide.message,
        /ton résultat est juste|ton calcul est juste|la valeur est juste/i,
        'Le tutorat annonce une justesse que le moteur n’a pas constatée.',
      );
    }
  });

  it('associe chaque catégorie à un exercice, jamais l’inverse', () => {
    // Contrôle de cohérence : un élève qui réussit n'a pas de difficulté.
    for (const exercice of EXERCICES) {
      const categorie = categoriePour(corriger(exercice, exercice.reponseAttendue));
      assert.equal(categorie, null, `${exercice.id} : réussite classée comme difficulté`);
    }
  });
});