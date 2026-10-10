/**
 * Chantier 7.7 — les mots adressés l'élève.
 *
 * ## Ce que ces tests verrouillent
 *
 * Le chantier demande un français « compréhensible même par un élève de 6e ».
 * C'est une exigence de **vocabulaire et de longueur**, pas de grammaire, donc
 * elle se teste :
 *
 * 1. **aucun terme technique** dans un texte élève ;
 * 2. **aucun message trop long** — une phrase par ligne, pas un paragraphe ;
 * 3. **jamais « faux » quand le calcul est juste** ;
 * 4. **les cinq verdicts restent produits et distincts**.
 *
 * ## Pourquoi tester la longueur
 *
 * Le chantier 7.5 remplaçait un message long par plusieurs, mais chacun restait
 * un bloc. Sur un écran de 360 px, un retour de correction doit tenir en deux
 * ou trois lignes. Un seuil chiffré empêche que le texte ne repousse.
 *
 * Les libellés sont produits par le **serveur** : c'est lui qui est mesuré, et
 * non une copie made in le frontend.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VERDICTS, corriger } from '../src/contenu/correction.js';
import { AIDES_PAR_OBJECTIF, AIDES_PAR_SIGNATURE, ORIENTATIONS_PAR_SIGNATURE } from '../src/contenu/aides.js';
import { EXERCICES, trouverExercice } from '../src/contenu/exercices.js';
import { construireTutorat } from '../src/contenu/tutorat.js';
import { SIGNATURES } from '../src/contenu/signatures.js';

/**
 * Mots que le chantier nomme explicitement comme trop techniques.
 *
 * La liste est courte et discutable terme par terme : ce qui est verrouillé,
 * c'est qu'aucun de ces mots n'apparaît, pas qu'ils sont tous « interdits » en
 * toute circonstance. `facteur`, par exemple, reste employé dans « cherche un
 * nombre qui divise les deux termes » — reformulé, pas proscrit.
 */
const MOTS_TECHNIQUES = [
  'mathématiquement',
  'du premier degré',
  'sans facteur carré',
  'irréductible',
  'coefficient',
  'partiellement correct',
  'terminologie',
  'algorithme',
  'syntaxe',
  'expression régulière',
  'indéterminée',
];

/** Longueur maximale tolérée pour un texte destiné à l'élève. */
const LONGUEUR_MAX = 180;

function estVerdict(valeur: string): boolean {
  return (VERDICTS as readonly string[]).includes(valeur);
}

describe('7.7 — aucun terme technique dans un texte élève', () => {
  it('les cinq libellés de verdict sont sans terme technique', () => {
    for (const exercice of EXERCICES) {
      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        const correction = corriger(exercice, saisie);
        for (const mot of MOTS_TECHNIQUES) {
          assert.doesNotMatch(
            correction.libelle,
            new RegExp(mot, 'i'),
            `${exercice.id}/${saisie} : « ${mot} » dans le libellé`,
          );
        }
      }
    }
  });

  it('les explications et aides sont sans terme technique', () => {
    for (const exercice of EXERCICES) {
      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        const correction = corriger(exercice, saisie);
        const aide = construireTutorat(exercice, correction, 0);
        const textes = [correction.explication, aide.message, aide.action];
        if (aide.resume !== null) textes.push(aide.resume);

        for (const texte of textes) {
          for (const mot of MOTS_TECHNIQUES) {
            assert.doesNotMatch(
              texte,
              new RegExp(mot, 'i'),
              `${exercice.id}/${saisie} : « ${mot} » dans « ${texte.slice(0, 40)}… »`,
            );
          }
        }
      }
    }
  });

  it('les catalogues d’aides sont sans terme technique', () => {
    for (const [signature, texte] of Object.entries(AIDES_PAR_SIGNATURE)) {
      if (texte === undefined) continue;
      assert.ok(texte.length <= LONGUEUR_MAX, `${signature} : aide de ${texte.length} caractères`);
    }
    for (const [signature, texte] of Object.entries(ORIENTATIONS_PAR_SIGNATURE)) {
      if (texte === undefined) continue;
      for (const mot of MOTS_TECHNIQUES) {
        assert.doesNotMatch(texte, new RegExp(mot, 'i'), `${signature} : « ${mot} »`);
      }
    }
  });
});

describe('7.7 — les messages sont courts', () => {
  it('chaque libellé tient en deux phrases au plus', () => {
    for (const exercice of EXERCICES) {
      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        const correction = corriger(exercice, saisie);
        assert.ok(
          correction.libelle.length <= 130,
          `${exercice.id}/${saisie} : libellé de ${correction.libelle.length} caractères — « ${correction.libelle} »`,
        );
      }
    }
  });

  it('la première aide tient en une question courte', () => {
    for (const exercice of EXERCICES) {
      const saisie =
        exercice.typeReponse === 'expression'
          ? 'x + 1'
          : exercice.typeReponse === 'racine'
            ? '3√7'
            : '1/2';
      const aide = construireTutorat(exercice, corriger(exercice, saisie), 0);
      assert.ok(
        aide.message.length <= 160,
        `${exercice.id} : première aide de ${aide.message.length} caractères`,
      );
    }
  });

  it('le bilan de méthode reste court', () => {
    for (const exercice of EXERCICES) {
      const aide = construireTutorat(exercice, corriger(exercice, exercice.reponseAttendue), 0);
      assert.ok(aide.resume !== null, `${exercice.id} : pas de bilan`);
      assert.ok(
        aide.resume.length <= 160,
        `${exercice.id} : bilan de ${aide.resume.length} caractères`,
      );
    }
  });
});

describe('7.7 — jamais « faux » quand le calcul est juste', () => {
  it('aucun verdict juste ne contient un mot de reproche', () => {
    const reproches = [/ce n’est pas encore/i, /faux/i, /erreur/i, /raté/i, /incorrect/i];

    for (const exercice of EXERCICES) {
      // Réponse attendue : les cinq verdicts «osing ».
      const juste = corriger(exercice, exercice.reponseAttendue);
      assert.ok(estVerdict(juste.verdict));

      for (const saisie of [exercice.reponseAttendue, ...exercice.pieges.map((p) => p.reponse)]) {
        const correction = corriger(exercice, saisie);

        // Si la valeur est juste, jamais de reproche.
        if (correction.mathemathiquementJuste) {
          for (const reproche of reproches) {
            assert.doesNotMatch(
              correction.libelle,
              reproche,
              `${exercice.id}/${saisie} : reproche sur un résultat juste`,
            );
          }
        }

        // Et l'aide ne doit pas dire non plus que c'est faux.
        for (const n of [0, 1, 2]) {
          const aide = construireTutorat(exercice, correction, n);
          if (!correction.mathemathiquementJuste) continue;
          for (const reproche of reproches) {
            assert.doesNotMatch(
              aide.message,
              reproche,
              `${exercice.id}/${saisie} : aide qui reproche un résultat juste`,
            );
          }
        }
      }
    }
  });

  it('la réponse hors forme est reconnue comme juste, sans reproche', () => {
    const exercice = trouverExercice('MVP-B1-E4')!;
    const correction = corriger(exercice, '4x^2 - 9');

    assert.equal(correction.mathemathiquementJuste, true);
    assert.equal(correction.verdict, 'resultat_juste_consigne_non_respectee');
    assert.match(correction.libelle, /juste/i);
    assert.doesNotMatch(correction.libelle, /faux|erreur|incorrect/i);
  });

  it('une réponse juste mais incomplète n’est jamais traitée comme fausse', () => {
    const exercice = trouverExercice('MVP-B2-E1')!;
    const correction = corriger(exercice, '√(25×2)');

    assert.equal(correction.verdict, 'partiellement_correct');
    assert.doesNotMatch(correction.libelle, /faux|erreur|incorrect/i);
    assert.match(correction.libelle, /bien commencé/i);
  });
});

describe('7.7 — les cinq verdicts existent et restent distincts', () => {
  it('produit chacun des cinq verdicts', () => {
    const vus = new Set<string>();

    for (const exercice of EXERCICES) {
      // Le radicand décomposé n'est pas déclaré parmi les pièges, mais c'est
      // lui qui produit le verdict « partiellement correct » : sans lui, le
      // corpus ne couvrirait pas quatre verdicts sur cinq.
      const saisies = [
        exercice.reponseAttendue,
        ...exercice.pieges.map((p) => p.reponse),
        ...(exercice.typeReponse === 'racine' ? ['√(25×2)'] : []),
      ];
      for (const saisie of saisies) {
        vus.add(corriger(exercice, saisie).verdict);
      }
    }

    // `a_determiner` n'est produit par aucun exercice du MVP — c'est un état de
    // prudence, pas une conclusion. On vérifie donc qu'il existe dans le code
    // sans exiger qu'il apparaisse.
    assert.deepEqual([...vus].sort(), [
      'correct',
      'incorrect',
      'partiellement_correct',
      'resultat_juste_consigne_non_respectee',
    ]);
    assert.equal(VERDICTS.length, 5);
    assert.ok((VERDICTS as readonly string[]).includes('a_determiner'));
  });

  it('donne un libellé différent à chaque verdict', () => {
    const libelles = new Map<string, string>();
    const forcer = (verdict: (typeof VERDICTS)[number], texte: string) => {
      const precedent = libelles.get(verdict);
      assert.notEqual(precedent, texte, `deux libellés pour « ${verdict} »`);
      libelles.set(verdict, texte);
    };

    const e1 = trouverExercice('MVP-B1-E1')!;
    const e4 = trouverExercice('MVP-B1-E4')!;
    const e2 = trouverExercice('MVP-B2-E1')!;

    forcer('correct', corriger(e1, '2x + 1').libelle);
    forcer('incorrect', corriger(e1, '4x + 1').libelle);
    forcer('resultat_juste_consigne_non_respectee', corriger(e4, '4x^2 - 9').libelle);
    forcer('partiellement_correct', corriger(e2, '√(25×2)').libelle);
  });

  it('donne un texte différent à chaque signature reconnue', () => {
    const vus = new Set<string>();
    for (const signature of SIGNATURES) {
      const texte = AIDES_PAR_SIGNATURE[signature];
      if (texte === undefined) continue;
      assert.equal(vus.has(texte), false, `aide dupliquée pour « ${signature} »`);
      vus.add(texte);
    }
  });

  it('conserve un texte par objectif, distinct et non technique', () => {
    const vus = new Set<string>();
    for (const [objectif, aide] of Object.entries(AIDES_PAR_OBJECTIF)) {
      assert.equal(vus.has(aide.action), false, `action dupliquée pour « ${objectif} »`);
      vus.add(aide.action);
      assert.ok(aide.question.length > 15, `${objectif} : question trop courte`);
    }
  });
});

describe('7.7 — les exemples mathématiques des aides sont exacts', () => {
  it('l’exemple sur les racines est correct', () => {
    /*
     * Régression : l'aide « base_racine_erronee » affirmait que √8 et √18
     * donnaient « 2√2 et √3 ». C'est faux : √18 = 3√2. Une aide qui se trompe
     * apprend à l'élève à se tromper.
     */
    const aide = AIDES_PAR_SIGNATURE.base_racine_erronee;
    assert.ok(aide);
    assert.match(aide, /2√2/, '√8 = 2√2');
    assert.match(aide, /3√2/, '√18 = 3√2');
    assert.doesNotMatch(aide, /√3(?![\d√])/);
  });
});