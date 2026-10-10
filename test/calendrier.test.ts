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

describe('année scolaire 2026-2027 (décision projet du lundi 7 septembre 2026)', () => {
  // Toutes les dates de cette suite sont **écrites explicitement**. Aucun de
  // ces tests ne lit l'horloge du poste : ils passent donc à l'identique le
  // 7 septembre 2026, en mars ou dix ans plus tard. C'est la condition pour
  // qu'un test de calendrier ait un sens.

  const DEBUT = '2026-09-07';

  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  /**
   * N-ième jour de la semaine `numero`, en partant du jour de rentrée.
   *
   * Les semaines sont des blocs de sept jours depuis le lundi 7 septembre
   * 2026 : `decalageJours` vaut 0 pour le premier jour de la semaine, 6 pour
   * le dernier.
   */
  function jourDeSemaine(numero: number, decalageJours = 0): Date {
    const date = new Date('2026-09-07T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + (numero - 1) * 7 + decalageJours);
    return date;
  }

  it('utilise le lundi 7 septembre 2026 comme date de référence par défaut', () => {
    assert.equal(DEBUT_ANNEE_DEFAUT, '2026-09-07');
    // La rentrée doit être un lundi : sinon toutes les ouvertures de blocs
    // tombent le même jour de la semaine que la rentrée, ce qui est inhabituel
    // pour une année scolaire. Ce contrôle empêche une régression silencieuse.
    const jour = new Date(`${DEBUT_ANNEE_DEFAUT}T00:00:00.000Z`).getUTCDay();
    assert.equal(JOURS[jour], 'lundi', `La rentrée doit tomber un lundi, or elle tombe ${JOURS[jour]}.`);
  });

  it('compte correctement les semaines à partir du 7 septembre 2026', () => {
    const attendu: ReadonlyArray<readonly [number, string]> = [
      [1, '2026-09-07'], // lundi de la semaine 1
      [2, '2026-09-14'],
      [5, '2026-10-05'], // ouverture de B2, un lundi
      [10, '2026-11-09'], // ouverture de B3, un lundi
      [16, '2026-12-21'], // leçon « Équations », hors MVP
      [30, '2027-03-29'], // dernière semaine de cours
    ];

    for (const [numero, iso] of attendu) {
      const position = positionnerDansLAnnee(new Date(`${iso}T00:00:00.000Z`), DEBUT);
      assert.equal(position.semaine, numero, `semaine attendue ${numero} pour le ${iso}`);
      assert.equal(position.dansAnneeScolaire, true);
      assert.equal(position.anneeTerminee, false);
    }
  });

  it('refuse toute date antérieure à la rentrée', () => {
    // Le 7 septembre est le début de l'année : il est exclu de cette liste,
    // et traité à part par le test des frontières.
    for (const iso of ['2026-08-25', '2026-08-31', '2026-09-04', '2026-09-06']) {
      const position = positionnerDansLAnnee(new Date(`${iso}T00:00:00.000Z`), DEBUT);
      assert.equal(position.dansAnneeScolaire, false, `date ${iso} acceptée à tort`);
      assert.equal(position.semaine, null, `date ${iso} acceptée à tort`);
      assert.equal(position.anneeTerminee, false);
    }
  });

  it('distingue le dimanche précédant la rentrée, la rentrée et le lundi suivant', () => {
    // Avec une rentrée un lundi, le dimanche 6 septembre doit encore être
    // hors année scolaire : c'est la frontière que le changement de date
    // déplace par rapport au 5 septembre.
    assert.equal(positionnerDansLAnnee(new Date('2026-09-05T00:00:00.000Z'), DEBUT).semaine, null);
    assert.equal(positionnerDansLAnnee(new Date('2026-09-06T00:00:00.000Z'), DEBUT).semaine, null);
    assert.equal(positionnerDansLAnnee(new Date('2026-09-07T00:00:00.000Z'), DEBUT).semaine, 1);
    assert.equal(positionnerDansLAnnee(new Date('2026-09-08T00:00:00.000Z'), DEBUT).semaine, 1);
  });

  it('découpe les semaines du lundi au dimanche', () => {
    // Les semaines sont des blocs de sept jours à partir de la date de
    // rentrée. La rentrée étant un lundi, la semaine 1 court du lundi 7 au
    // dimanche 13 septembre, et la semaine 2 commence le lundi 14.
    assert.equal(positionnerDansLAnnee(new Date('2026-09-07T00:00:00.000Z'), DEBUT).semaine, 1);
    assert.equal(positionnerDansLAnnee(new Date('2026-09-13T00:00:00.000Z'), DEBUT).semaine, 1);
    assert.equal(positionnerDansLAnnee(new Date('2026-09-14T00:00:00.000Z'), DEBUT).semaine, 2);

    // Frontière d'ouverture de B3 : S9 se termine, S10 commence.
    const finS9 = new Date('2026-11-08T00:00:00.000Z');
    const debutS10 = new Date('2026-11-09T00:00:00.000Z');
    assert.equal(positionnerDansLAnnee(finS9, DEBUT).semaine, 9);
    assert.equal(positionnerDansLAnnee(debutS10, DEBUT).semaine, 10);
  });

  it('ouvre chaque bloc un lundi, aux semaines du MVP', () => {
    // B1 : S1 · B2 : S5 · B3 : S10. Ces semaines sont le séquencement validé ;
    // ce test en garantit la tenue, il ne les redéfinit pas.
    const REPERES: ReadonlyArray<readonly [string, number]> = [
      ['B1', 1],
      ['B2', 5],
      ['B3', 10],
    ];

    for (const [id, semaineDebut] of REPERES) {
      const bloc = BLOCS.find((b) => b.id === id);
      assert.ok(bloc, `Bloc ${id} introuvable`);
      assert.equal(bloc.semaineDebut, semaineDebut, `${id} : semaine d'ouverture déplacée`);

      // Chaque ouverture doit tomber un lundi.
      const jour = new Date(`${DEBUT}T00:00:00.000Z`);
      jour.setUTCDate(jour.getUTCDate() + (semaineDebut - 1) * 7);
      assert.equal(
        JOURS[jour.getUTCDay()],
        'lundi',
        `${id} : ouverture le ${jour.toISOString().slice(0, 10)}, qui n'est pas un lundi.`,
      );

      // Juste avant : fermé. Exactement à la semaine : ouvert.
      const avant = positionnerDansLAnnee(jourDeSemaine(semaineDebut - 1, 6), DEBUT);
      const jourOuverture = positionnerDansLAnnee(jourDeSemaine(semaineDebut, 0), DEBUT);

      assert.equal(blocDisponible(bloc.semaineDebut, avant), false, `${id} : ouvert trop tôt`);
      assert.equal(
        blocDisponible(bloc.semaineDebut, jourOuverture),
        true,
        `${id} : pas ouvert à temps`,
      );
    }
  });

  it('ferme l’année après la trenteième semaine', () => {
    const derniere = positionnerDansLAnnee(jourDeSemaine(NOMBRE_SEMAINES, 6), DEBUT);
    assert.equal(derniere.semaine, NOMBRE_SEMAINES);
    assert.equal(derniere.dansAnneeScolaire, true);

    const apres = positionnerDansLAnnee(jourDeSemaine(NOMBRE_SEMAINES + 1, 0), DEBUT);
    assert.equal(apres.semaine, null);
    assert.equal(apres.dansAnneeScolaire, false);
    assert.equal(apres.anneeTerminee, true);
  });

  it('ignore la variable d’environnement absente et se rabat sur le défaut', () => {
    // La fonction de positionnement ne lit pas l'environnement : c'est la
    // route qui le fait. Ce test verrouille que le **défaut** est bien
    // 2026-09-07, donc qu'une variable manquante ne retombe pas sur 2025.
    // Le lundi 5 octobre est le premier jour de la semaine 5 ; le mardi 6
    // octobre est toujours en semaine 5. La semaine 6 commence le lundi 12.
    assert.equal(positionnerDansLAnnee(new Date('2026-10-05T00:00:00.000Z')).semaine, 5);
    assert.equal(positionnerDansLAnnee(new Date('2026-10-06T00:00:00.000Z')).semaine, 5);
    assert.equal(positionnerDansLAnnee(new Date('2026-10-12T00:00:00.000Z')).semaine, 6);
    assert.equal(positionnerDansLAnnee(new Date('2026-10-05T00:00:00.000Z')).semaine, 5);
  });

  it('refuse une date de début mal formée plutôt que de la deviner', () => {
    assert.throws(() => positionnerDansLAnnee(new Date(), 'pas-une-date'));
    assert.throws(() => positionnerDansLAnnee(new Date(), ''));
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