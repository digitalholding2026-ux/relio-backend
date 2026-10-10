import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BLOCS } from '../src/contenu/blocs.js';
import {
  blocDisponible,
  DEBUT_ANNEE_DEFAUT,
  NOMBRE_SEMAINES,
  positionnerDansLAnnee,
  semainesAvantOuverture,
} from '../src/lib/calendrier.js';

/**
 * Tests du calendrier — le garde-fou du chantier 6 (F2).
 *
 * Un élève ne doit jamais être évalué sur une leçon qui n'a pas encore été
 * enseignée. Ces tests vérifient que l'ouverture des blocs suit bien les
 * semaines du référentiel annuel.
 */

/** Date ISO située dans la semaine `numero` de l'année scolaire (1 = première). */
function dateDeSemaine(numero: number): Date {
  const debut = new Date(`${DEBUT_ANNEE_DEFAUT}T00:00:00.000Z`);
  debut.setUTCDate(debut.getUTCDate() + (numero - 1) * 7 + 3);
  return debut;
}

describe('positionnement dans l’année scolaire', () => {
  it('place la première semaine au tout début de l’année', () => {
    const position = positionnerDansLAnnee(dateDeSemaine(1));
    assert.equal(position.semaine, 1);
    assert.equal(position.dansAnneeScolaire, true);
    assert.equal(position.anneeTerminee, false);
  });

  it('compte les semaines correctement', () => {
    for (const numero of [1, 2, 5, 10, 16, 30]) {
      assert.equal(positionnerDansLAnnee(dateDeSemaine(numero)).semaine, numero, `semaine ${numero}`);
    }
  });

  it('déclare l’année terminée après la dernière semaine', () => {
    const position = positionnerDansLAnnee(dateDeSemaine(NOMBRE_SEMAINES + 1));
    assert.equal(position.dansAnneeScolaire, false);
    assert.equal(position.anneeTerminee, true);
    assert.equal(position.semaine, null);
  });

  it('refuse d’ouvrir quoi que ce soit avant la rentrée', () => {
    const avant = new Date('2025-08-20T00:00:00.000Z');
    const position = positionnerDansLAnnee(avant);
    assert.equal(position.dansAnneeScolaire, false);
    assert.equal(position.semaine, null);
    assert.equal(position.anneeTerminee, false);
  });

  it('refuse une date de début mal formée', () => {
    assert.throws(() => positionnerDansLAnnee(new Date(), 'pas-une-date'));
  });
});

describe('ouverture des blocs', () => {
  it('B1 est ouvert dès la première semaine', () => {
    const b1 = BLOCS.find((bloc) => bloc.id === 'B1');
    assert.ok(b1);
    assert.equal(b1.semaineDebut, 1);
    assert.equal(blocDisponible(b1.semaineDebut, positionnerDansLAnnee(dateDeSemaine(1))), true);
  });

  it('B2 n’est pas ouvert avant la semaine 5', () => {
    const b2 = BLOCS.find((bloc) => bloc.id === 'B2');
    assert.ok(b2);
    assert.equal(b2.semaineDebut, 5);

    for (const semaine of [1, 2, 3, 4]) {
      const position = positionnerDansLAnnee(dateDeSemaine(semaine));
      assert.equal(blocDisponible(b2.semaineDebut, position), false, `semaine ${semaine}`);
      assert.equal(semainesAvantOuverture(b2.semaineDebut, position), 5 - semaine);
    }
    assert.equal(blocDisponible(b2.semaineDebut, positionnerDansLAnnee(dateDeSemaine(5))), true);
  });

  it('B3 n’est pas ouvert avant la semaine 10', () => {
    const b3 = BLOCS.find((bloc) => bloc.id === 'B3');
    assert.ok(b3);
    assert.equal(b3.semaineDebut, 10);

    for (const semaine of [1, 5, 9]) {
      const position = positionnerDansLAnnee(dateDeSemaine(semaine));
      assert.equal(blocDisponible(b3.semaineDebut, position), false, `semaine ${semaine}`);
    }
    assert.equal(blocDisponible(b3.semaineDebut, positionnerDansLAnnee(dateDeSemaine(10))), true);
  });

  it('ferme tous les blocs hors année scolaire', () => {
    const terminee = positionnerDansLAnnee(dateDeSemaine(NOMBRE_SEMAINES + 2));
    for (const bloc of BLOCS) {
      assert.equal(blocDisponible(bloc.semaineDebut, terminee), false, bloc.id);
      assert.equal(semainesAvantOuverture(bloc.semaineDebut, terminee), null);
    }
  });

  it('n’ouvre jamais un bloc dont l’exercice est antérieur au sien', () => {
    // Invariant de cohérence : un bloc ne s'ouvre jamais avant sa semaine,
    // quel que soit l'état du calendrier.
    for (const bloc of BLOCS) {
      for (let semaine = 1; semaine <= NOMBRE_SEMAINES; semaine += 1) {
        const ouvert = blocDisponible(bloc.semaineDebut, positionnerDansLAnnee(dateDeSemaine(semaine)));
        assert.equal(ouvert, semaine >= bloc.semaineDebut, `${bloc.id} semaine ${semaine}`);
      }
    }
  });
});