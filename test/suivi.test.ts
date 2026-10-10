/**
 * Chantier 7.5 — suivi des difficultés.
 *
 * Le risque principal de ce module n'est pas qu'il se trompe, mais qu'il
 * **surinterprète**. Ces tests verrouillent donc surtout les prudences :
 *
 * 1. **absence de donnée ≠ difficulté** — un objectif sans observation reste
 *    `donnee_insuffisante` ;
 * 2. **une réussite après aide n'est jamais une maîtrise** — aucun état de ce
 *    module ne s'appelle « maîtrisé », et `a_confirmer` est le seul état
 *    possible pour une réussite tardive ;
 * 3. **une difficulté n'est dite récurrente qu'à deux observations** ;
 * 4. **l'ordre des tentatives est reconstruit**, pas supposé : le client peut
 *    renvoyer ses observations dans le désordre après une reconnexion ;
 * 5. **une observation ne suffit pas à conclure** : un seul exercice réussi
 *    sans aide reste `donnee_insuffisante`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { suivreObjectif, suivreProgression, type Observation } from '../src/lib/suivi.js';

const OBJECTIF = 'OO-L1-1';

/** Construit une observation complète, avec des valeurs par défaut saines. */
function obs(partiel: Partial<Observation> & { exerciceId: string; rang: number }): Observation {
  return {
    objectifId: OBJECTIF,
    reponse: 'x',
    statut: 'fausse',
    categorie: 'erreur_non_identifiee',
    niveauAide: 1,
    reussiteApresAides: false,
    ...partiel,
  };
}

describe('7.5 — absence de donnée n’est pas une difficulté', () => {
  it('reste sans donnée sans la dégradée', () => {
    const suivi = suivreObjectif(OBJECTIF, []);
    assert.equal(suivi.niveau, 'donnee_insuffisante');
    assert.equal(suivi.exercicesTraites, 0);
    assert.equal(suivi.tentatives, 0);
    assert.deepEqual(suivi.difficultesRecurrentes, []);
  });

  it('ne dégrade pas un objectif sans observation parmi d’autres', () => {
    const suivi = suivreProgression(
      [obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'correcte', categorie: null })],
      ['OO-L1-1', 'OO-L3-1', 'OO-L5-1'],
    );
    const radical = suivi.find((s) => s.objectifId === 'OO-L3-1');
    assert.ok(radical);
    assert.equal(radical.niveau, 'donnee_insuffisante');
    assert.equal(radical.exercicesTraites, 0);
  });
});

describe('7.5 — une réussite après aide n’est pas une maîtrise', () => {
  it('classe « a_confirmer » une réussite obtenue après une aide', () => {
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'fausse' }),
      obs({ exerciceId: 'MVP-B1-E1', rang: 2, statut: 'correcte', categorie: null }),
    ]);
    assert.equal(suivi.reussisApresUnIndice, 1);
    assert.equal(suivi.reussisSansAide, 0);
    assert.equal(suivi.niveau, 'a_confirmer');
  });

  it('ne conclut rien sur un seul exercice réussi sans aide', () => {
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'correcte', categorie: null }),
    ]);
    assert.equal(suivi.reussisSansAide, 1);
    assert.equal(suivi.niveau, 'donnee_insuffisante');
  });

  it('ne déclare « réussite immédiate » qu’au moins deux exercices', () => {
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'correcte', categorie: null }),
      obs({ exerciceId: 'MVP-B1-E2', rang: 1, statut: 'correcte', categorie: null }),
    ]);
    assert.equal(suivi.niveau, 'reussite_immediate');
  });

  it('compte les niveaux d’aide réellement traversés', () => {
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'fausse' }),
      obs({ exerciceId: 'MVP-B1-E1', rang: 2, statut: 'fausse', categorie: 'erreur_de_signe' }),
      obs({ exerciceId: 'MVP-B1-E1', rang: 3, statut: 'correcte', categorie: null }),
    ]);
    assert.equal(suivi.reussisApresPlusieursAides, 1);
    assert.equal(suivi.reussisSansAide, 0);
    assert.equal(suivi.tentatives, 3);
  });
});

describe('7.5 — difficultés récurrentes', () => {
  it('n’en déclare aucune en dessous de deux observations', () => {
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'fausse', categorie: 'erreur_de_signe' }),
    ]);
    assert.deepEqual(suivi.difficultesRecurrentes, []);
    assert.equal(suivi.niveau, 'a_confirmer', 'Un seul échec isolé n’est pas une difficulté.');
  });

  it('en déclare dès la deuxième observation de même catégorie', () => {
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'fausse', categorie: 'erreur_de_signe' }),
      obs({ exerciceId: 'MVP-B1-E2', rang: 1, statut: 'fausse', categorie: 'erreur_de_signe' }),
    ]);
    assert.deepEqual(suivi.difficultesRecurrentes, [
      { categorie: 'erreur_de_signe', occurrences: 2 },
    ]);
    assert.equal(suivi.niveau, 'difficulte');
  });

  it('classe « difficile » sur deux exercices non aboutis', () => {
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'fausse' }),
      obs({ exerciceId: 'MVP-B1-E2', rang: 1, statut: 'fausse' }),
    ]);
    assert.equal(suivi.nonReussis, 2);
    assert.equal(suivi.niveau, 'difficulte');
  });

  it('ignore les réussites dans le décompte des difficultés', () => {
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'correcte', categorie: null }),
      obs({ exerciceId: 'MVP-B1-E2', rang: 1, statut: 'correcte', categorie: null }),
    ]);
    assert.deepEqual(suivi.difficultesRecurrentes, []);
    assert.equal(suivi.nonReussis, 0);
  });

  it('compte une réponse partielle comme un non-abandon', () => {
    // `partielle` = juste mais hors forme : ce n'est ni juste ni abouti.
    const suivi = suivreObjectif(OBJECTIF, [
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'partielle', categorie: 'fraction_non_reduite' }),
    ]);
    assert.equal(suivi.nonReussis, 1);
  });
});

describe('7.5 — l’ordre des tentatives est reconstruit', () => {
  it('ne confond pas « réussi du premier coup » et « réussi après un essai »', () => {
    // Le client renvoie les tentatives dans le désordre (reconnexion). Sans
    // reclassement par `rang`, l'exercice serait compté « réussi sans aide ».
    const desordre = [
      obs({ exerciceId: 'MVP-B1-E1', rang: 2, statut: 'correcte', categorie: null }),
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'fausse' }),
    ];
    const suivi = suivreObjectif(OBJECTIF, desordre);
    assert.equal(suivi.reussisApresUnIndice, 1);
    assert.equal(suivi.reussisSansAide, 0);
  });

  it('compte la première réussite, pas la dernière', () => {
    const observations = [
      obs({ exerciceId: 'MVP-B1-E1', rang: 3, statut: 'correcte', categorie: null }),
      obs({ exerciceId: 'MVP-B1-E1', rang: 1, statut: 'fausse' }),
      obs({ exerciceId: 'MVP-B1-E1', rang: 2, statut: 'correcte', categorie: null }),
    ];
    const suivi = suivreObjectif(OBJECTIF, observations);
    assert.equal(suivi.reussisApresUnIndice, 1, 'La première réussite était à la 2e tentative.');
  });
});

describe('7.5 — aucune donnée personnelle dans le suivi', () => {
  it('ne conserve que les champs strictement pédagogiques', () => {
    const observation = obs({ exerciceId: 'MVP-B1-E1', rang: 1 });
    const champs = Object.keys(observation).sort();
    assert.deepEqual(champs, [
      'categorie',
      'exerciceId',
      'niveauAide',
      'objectifId',
      'rang',
      'reponse',
      'reussiteApresAides',
      'statut',
    ]);
    // Aucun nom, aucun identifiant d'élève, aucune date de naissance.
    for (const interdit of ['nom', 'prenom', 'email', 'idEleve', 'dateNaissance', 'telephone']) {
      assert.ok(!(interdit in observation), `${interdit} ne doit jamais être collecté.`);
    }
  });
});