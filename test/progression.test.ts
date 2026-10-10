import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OBJECTIFS } from '../src/contenu/blocs.js';
import {
  evaluerObjectif,
  evaluerProgression,
  prerequisAtteints,
  STATUTS_OBJECTIF,
  type ReponseExercice,
  type StatutObjectif,
} from '../src/lib/progression.js';

/**
 * Tests de la progression — application de la règle des trois.
 *
 * La règle la plus importante n'est pas un calcul : c'est qu'un objectif
 * **sans donnée reste `non_evalue`** et ne devient jamais `non_acquis`.
 * L'absence de réponse est un manque de données, pas une difficulté.
 */

function reponses(statuts: Array<[string, ReponseExercice['statut']]>, objectifId = 'OO-L1-1'): ReponseExercice[] {
  return statuts.map(([exerciceId, statut], index) => ({
    exerciceId: `${exerciceId}-${index}`,
    objectifId,
    statut,
  }));
}

describe('objectif sans donnée', () => {
  it('reste non_evalue et ne se dégrade jamais', () => {
    const progression = evaluerObjectif('OO-L1-1', []);
    assert.equal(progression.statut, 'non_evalue');
    assert.equal(progression.sansDonnee, true);
    assert.equal(progression.itemsFausses, 0);
    assert.equal(progression.borneSuperieureErreurPct, null);
  });

  it('n’expose jamais de statut « non_acquis »', () => {
    // Le vocabulaire lui-même ne contient pas « non_acquis » : c'est
    // structurel, pas seulement évité à l'exécution.
    assert.ok(!STATUTS_OBJECTIF.includes('non_acquis' as StatutObjectif));
  });
});

describe('règle des trois', () => {
  it('une seule réponse juste ne conclut rien', () => {
    const progression = evaluerObjectif('OO-L1-1', reponses([['a', 'correcte']]));
    assert.equal(progression.statut, 'non_evalue');
    // Borne supérieure du taux d'erreur : 3/1 = 300 %. Rien n'est concluant.
    assert.equal(progression.borneSuperieureErreurPct, 300);
  });

  it('deux réponses justes ne concluent toujours rien', () => {
    const progression = evaluerObjectif('OO-L1-1', reponses([['a', 'correcte'], ['b', 'correcte']]));
    assert.equal(progression.statut, 'non_evalue');
    assert.equal(progression.borneSuperieureErreurPct, 150);
  });

  it('quatre réponses justes commencent à informer', () => {
    const progression = evaluerObjectif(
      'OO-L1-1',
      reponses([['a', 'correcte'], ['b', 'correcte'], ['c', 'correcte'], ['d', 'correcte']]),
    );
    assert.equal(progression.statut, 'constat');
    assert.equal(progression.borneSuperieureErreurPct, 75);
  });

  it('une erreur isolée ne produit qu’un signal', () => {
    const progression = evaluerObjectif('OO-L1-1', reponses([['a', 'fausse']]));
    assert.equal(progression.statut, 'signal');
    assert.equal(progression.itemsFausses, 1);
  });

  it('deux erreurs font une hypothèse', () => {
    const progression = evaluerObjectif(
      'OO-L1-1',
      reponses([['a', 'fausse'], ['b', 'fausse']]),
    );
    assert.equal(progression.statut, 'hypothese');
  });

  it('une partielle est une donnée, pas une absence', () => {
    const progression = evaluerObjectif('OO-L1-1', reponses([['a', 'correcte'], ['b', 'partielle']]));
    assert.equal(progression.itemsPartiels, 1);
    assert.equal(progression.sansDonnee, false);
    assert.ok(progression.statut !== 'non_evalue');
  });

  it('compte les statuts indéterminés comme des erreurs', () => {
    const progression = evaluerObjectif(
      'OO-L1-1',
      reponses([['a', 'indeterminee'], ['b', 'indeterminee']]),
    );
    assert.equal(progression.itemsFausses, 2);
    assert.equal(progression.statut, 'hypothese');
  });

  it('ne donne pas de borne d’erreur dès qu’une erreur est observée', () => {
    const progression = evaluerObjectif('OO-L1-1', reponses([['a', 'correcte'], ['b', 'fausse']]));
    assert.equal(progression.borneSuperieureErreurPct, null);
  });
});

describe('progression multi-objectifs', () => {
  it('produit une ligne par objectif du MVP, y compris sans donnée', () => {
    const progression = evaluerProgression([], OBJECTIFS.map((o) => o.id));
    assert.equal(progression.length, 5);
    for (const ligne of progression) {
      assert.equal(ligne.statut, 'non_evalue');
      assert.equal(ligne.sansDonnee, true);
    }
  });

  it('sépare les objectifs', () => {
    const journal: ReponseExercice[] = [
      { exerciceId: 'a', objectifId: 'OO-L1-1', statut: 'fausse' },
      { exerciceId: 'b', objectifId: 'OO-L1-1', statut: 'fausse' },
      { exerciceId: 'c', objectifId: 'OO-L3-1', statut: 'correcte' },
    ];
    const progression = evaluerProgression(journal, ['OO-L1-1', 'OO-L3-1', 'OO-L5-1']);
    assert.equal(progression[0]?.statut, 'hypothese');
    assert.equal(progression[1]?.statut, 'non_evalue');
    assert.equal(progression[2]?.statut, 'non_evalue');
  });
});

describe('prérequis', () => {
  it('ne sont pas atteints tant que le prérequis n’a aucun statut', () => {
    const progression = evaluerProgression([], ['OO-L1-1', 'OO-L1-2']);
    assert.equal(prerequisAtteints('OO-L1-2', progression, ['OO-L1-1']), false);
  });

  it('sont atteints dès que le prérequis présente un signal', () => {
    const journal: ReponseExercice[] = [{ exerciceId: 'a', objectifId: 'OO-L1-1', statut: 'fausse' }];
    const progression = evaluerProgression(journal, ['OO-L1-1', 'OO-L1-2']);
    assert.equal(prerequisAtteints('OO-L1-2', progression, ['OO-L1-1']), true);
  });

  it('ne sont pas atteints pour un objectif inconnu', () => {
    const progression = evaluerProgression([], ['OO-L1-2']);
    assert.equal(prerequisAtteints('OBJECTIF-QUI-EXISTE-PAS', progression, ['OO-L1-1']), false);
  });
});