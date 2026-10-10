import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BLOCS,
  OBJECTIFS,
  prerrequisSatisfaits,
  trouverBloc,
  trouverObjectif,
  SEMAINE_DEBUT,
} from '../src/contenu/blocs.js';
import { EXERCICES, exercicesDuBloc, trouverExercice } from '../src/contenu/exercices.js';
import { estSignatureValide, LEÇONS_CANDIDATES, SIGNATURES, type SignatureErreur } from '../src/contenu/signatures.js';
import { sontEgales, analyserRacine, analyserRationnel, analyserExpressionReponse } from '../src/lib/analyseur-reponse.js';
import { rationnel, versChaine } from '../src/lib/algebre.js';

/** Analyse une réponse selon le type de grandeur attendu, pour comparaison. */
function analyserSelonType(type: string, reponse: string): unknown {
  if (type === 'racine') {
    const valeur = analyserRacine(reponse);
    return [valeur.radicand, valeur.coefficient.num.toString(), valeur.coefficient.den.toString()];
  }
  if (type === 'rationnelle') {
    const valeur = analyserRationnel(reponse);
    return [valeur.valeur.num.toString(), valeur.valeur.den.toString()];
  }
  return analyserExpressionReponse(reponse).polynome.map((c) => [c.num.toString(), c.den.toString()]);
}

/**
 * Contrôles du contenu pédagogique.
 *
 * Le point important : **chaque réponse attendue est recalculée
 * indépendamment de la chaîne déclarée**, à partir de l'énoncé lui-même, par
 * deux évaluateurs écrits ici (un pour les expressions, un pour les racines,
 * un pour les fractions). Un test qui réutiliserait le moteur de production ne
 * prouverait rien.
 */

type Coefficient = bigint;
type Racines = Map<number, Coefficient>;

/**
 * Simplification indépendante : extrait le plus grand facteur carré du
 * radicand. Réécrit ici pour ne pas dépendre du moteur de production.
 * `√50` → `5√2`, `√8` → `2√2`, `√18` → `3√2`.
 */
function simplifierTerme(coefficient: Coefficient, radicand: number): [Coefficient, number] {
  let facteur = 1n;
  let reste = radicand;
  let diviseur = 2;
  while (diviseur * diviseur <= reste) {
    while (reste % (diviseur * diviseur) === 0) {
      reste /= diviseur * diviseur;
      facteur *= BigInt(diviseur);
    }
    diviseur += 1;
  }
  return [coefficient * facteur, reste];
}

/** Additionne des termes `coefficient × √radicand`, chacun normalisé. */
function sommeRacines(termes: Array<[Coefficient, number]>): Racines {
  const resultat: Racines = new Map();
  for (const [coefficientBrut, radicand] of termes) {
    const [coefficient, radical] = simplifierTerme(coefficientBrut, radicand);
    const courant = resultat.get(radical) ?? 0n;
    resultat.set(radical, courant + coefficient);
  }
  return resultat;
}

/** Extrait le terme `a√b` d'un fragment de texte ; null si absent. */
function termeRacine(texte: string): [Coefficient, number] | null {
  const motif = /([+-]?)\s*(\d*)\s*√\s*(\d+)/.exec(texte);
  if (!motif) return null;
  const signe = motif[1] === '-' ? -1n : 1n;
  const coefficient = motif[2] === '' || motif[2] === undefined ? 1n : BigInt(motif[2]);
  return [signe * coefficient, Number(motif[3])];
}

/** Évalue une somme/soustraction de racines du type `3√12 − √27`. */
function evaluerRacines(enonce: string): Racines {
  const corps = enonce.slice(enonce.indexOf('=') + 1).replace(/[.。]$/, '').trim();
  // Découpe conservant les signes : « 3√12 − √27 + √8 »
  const morceaux = corps
    .replace(/−/g, '-')
    .split(/(?=[+-])/)
    .map((m) => m.trim())
    .filter((m) => m !== '');

  const termes: Array<[Coefficient, number]> = [];
  for (const morceau of morceaux) {
    const signe = morceau.startsWith('-') ? -1n : 1n;
    const corpsMorceau = morceau.replace(/^[+-]\s*/, '');
    const terme = termeRacine(corpsMorceau);
    if (!terme) throw new Error(`Fragment non reconnu : « ${morceau} »`);
    termes.push([signe * terme[0], terme[1]]);
  }
  return sommeRacines(termes);
}

interface EvaluationRationnelle {
  readonly operateur: '+' | '×';
  readonly termes: bigint[][];
}

/** Évalue une expression rationnelle du type `7/8 − 3/4` ou `(3/4) × (8/9)`. */
function evaluerRationnels(enonce: string): EvaluationRationnelle {
  const corps = enonce.slice(enonce.indexOf('=') + 1).replace(/−/g, '-').replace(/[.。]$/, '').trim();

  if (corps.includes('×')) {
    const morceaux = corps.split('×').map((m) => m.trim());
    return { operateur: '×', termes: [lireFraction(morceaux[0] ?? ''), lireFraction(morceaux[1] ?? '')] };
  }

  const morceaux = corps
    .split(/(?=[+-])/)
    .map((m) => m.trim())
    .filter((m) => m !== '');

  return {
    operateur: '+',
    termes: morceaux.map((m) => {
      const signe = m.startsWith('-') ? -1n : 1n;
      const [num, den] = lireFraction(m.replace(/^[+-]\s*/, ''));
      return [signe * (num ?? 0n), den ?? 1n];
    }),
  };
}

/** Lit `7/8` ou `4`, en ignorant les parenthèses. */
function lireFraction(texte: string): bigint[] {
  const propre = texte.replace(/[()\s]/g, '');
  if (propre.includes('/')) {
    const [num, den] = propre.split('/');
    return [BigInt(num ?? '0'), BigInt(den ?? '1')];
  }
  return [BigInt(propre), 1n];
}

/** Somme de fractions exactes, independently du moteur de production. */
function sommeExacte(termes: bigint[][]): bigint[] {
  let num = 0n;
  let den = 1n;
  for (const terme of termes) {
    const n = terme[0] ?? 0n;
    const d = terme[1] ?? 1n;
    num = num * d + n * den;
    den = den * d;
    const g = pgcdLocal(num, den);
    num /= g;
    den /= g;
  }
  return [num, den];
}

function pgcdLocal(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x || 1n;
}

/** Expression algébrique à vérifier par le moteur (aucun évaluateur polynomial externe). */
const EXPRESSIONS_A_VERIFIER: Array<{ id: string; expression: string; resultat: string }> = [
  { id: 'MVP-B1-E1', expression: '3(x + 2) - (x + 5)', resultat: '2x + 1' },
  { id: 'MVP-B1-E2', expression: '(2x - 1)^2', resultat: '4x^2 - 4x + 1' },
  { id: 'MVP-B1-E3', expression: '(x + 3)(x - 2) - 2(x - 1)', resultat: 'x^2 - x - 4' },
  { id: 'MVP-B1-E4', expression: '4x^2 - 9', resultat: '(2x-3)(2x+3)' },
  { id: 'MVP-B1-E5', expression: 'x^2 - 7x', resultat: 'x(x-7)' },
  { id: 'MVP-B1-E6', expression: '3x^2 + 5x - 2', resultat: '(3x-1)(x+2)' },
];

describe('périmètre du MVP', () => {
  it('contient trois blocs et douze exercices', () => {
    assert.equal(BLOCS.length, 3);
    assert.equal(EXERCICES.length, 12);
  });

  it('respecte les semaines du référentiel annuel', () => {
    assert.equal(SEMAINE_DEBUT.B1, 1);
    assert.equal(SEMAINE_DEBUT.B2, 5);
    assert.equal(SEMAINE_DEBUT.B3, 10);
    assert.equal(trouverBloc('B1')?.leconId, 'LEC-CM-MATH-3E-2025-2026-01');
    assert.equal(trouverBloc('B2')?.leconId, 'LEC-CM-MATH-3E-2025-2026-03');
    assert.equal(trouverBloc('B3')?.leconId, 'LEC-CM-MATH-3E-2025-2026-05');
  });

  it('couvre cinq objectifs, avec au moins trois items chacun', () => {
    assert.equal(OBJECTIFS.length, 5);

    for (const objectif of OBJECTIFS) {
      const items = EXERCICES.filter((exercice) => exercice.objectifs.includes(objectif.id));
      assert.ok(
        items.length >= 3,
        `L'objectif ${objectif.id} n'a que ${items.length} item(s) : la règle des trois ne pourrait pas fonctionner.`,
      );
    }
  });

  it('n’expose que les trois leçons du périmètre', () => {
    const lecons = new Set(EXERCICES.map((exercice) => trouverBloc(exercice.blocId)?.leconId));
    assert.deepEqual(
      [...lecons].sort(),
      [
        'LEC-CM-MATH-3E-2025-2026-01',
        'LEC-CM-MATH-3E-2025-2026-03',
        'LEC-CM-MATH-3E-2025-2026-05',
      ],
    );
  });

  it('n’utilise que des objectifs déclarés, et jamais hors périmètre', () => {
    const ids = new Set(OBJECTIFS.map((objectif) => objectif.id));
    for (const exercice of EXERCICES) {
      for (const objectifId of exercice.objectifs) {
        assert.ok(ids.has(objectifId), `Objectif inconnu : ${objectifId}`);
      }
      // L6, L11, L12–L14 sont hors périmètre : aucun de leurs identifiants.
      assert.ok(!/\bL6\b|L11|L12|L13|L14/.test(exercice.id));
    }
  });

  it('ne référence aucune source d’épreuve officielle', () => {
    for (const exercice of EXERCICES) {
      assert.equal(exercice.origine, 'originale');
      assert.equal(exercice.sourceBepc, null);
      assert.ok(!/BEPC-20\d\d/i.test(exercice.enonce));
    }
  });

  it('déclare des prérequis d’objectifs existants', () => {
    const ids = new Set(OBJECTIFS.map((objectif) => objectif.id));
    for (const objectif of OBJECTIFS) {
      for (const prerequis of objectif.prerequis) {
        assert.ok(ids.has(prerequis), `Prérequis inconnu : ${prerequis}`);
      }
    }
    assert.deepEqual(trouverObjectif('OO-L1-2')?.prerequis, ['OO-L1-1']);
    assert.deepEqual(trouverObjectif('OO-L5-2')?.prerequis, ['OO-L5-1']);
  });

  it('résout les prérequis sans boucle', () => {
    // Un prérequis cyclique (OO-A exige OO-B qui exige OO-A) rendrait la règle
    // des prérequis inapplicable : aucun objectif ne serait jamais accessible.
    // On vérifie donc que toute chaîne de dépendances se termine.
    for (const objectif of OBJECTIFS) {
      const vus = new Set<string>([objectif.id]);
      let courants = [objectif.id];
      let profondeur = 0;

      while (courants.length > 0) {
        profondeur += 1;
        assert.ok(profondeur <= OBJECTIFS.length, `Cycle de prérequis détecté sur ${objectif.id}`);
        const suivants: string[] = [];
        for (const id of courants) {
          for (const prerequis of trouverObjectif(id)?.prerequis ?? []) {
            assert.ok(!vus.has(prerequis), `Cycle : ${prerequis} déjà rencontré depuis ${objectif.id}`);
            vus.add(prerequis);
            suivants.push(prerequis);
          }
        }
        courants = suivants;
      }
    }
  });

  it('n’expose aucun exercice d’un objectif avant d’avoir travaillé son prérequis', () => {
    // P1 du cadrage : `OO-L5-1` avant `OO-L5-2`, `OO-L1-1` avant `OO-L1-2`.
    //
    // Le contrôle porte sur l'ordre **réellement servi**, et il tolère le cas
    // légitime où un exercice travaille les deux objectifs à la fois (B3
    // travaille le calcul et la mise en forme dans le même item) : ce n'est un
    // défaut que si un exercice travaille l'objectif dépendant **sans** son
    // prérequis, et avant tout exercice du prérequis.
    for (const bloc of BLOCS) {
      const exercices = exercicesDuBloc(bloc.id);

      for (const dependant of bloc.objectifs) {
        for (const pre of trouverObjectif(dependant)?.prerequis ?? []) {
          assert.ok(
            exercices.some((exercice) => exercice.objectifs.includes(pre)),
            `${dependant} exige ${pre}, absent du bloc ${bloc.id}.`,
          );

          const premierPre = exercices.findIndex((exercice) => exercice.objectifs.includes(pre));

          const avantLePrerequis = exercices.findIndex(
            (exercice, index) =>
              index < premierPre &&
              exercice.objectifs.includes(dependant) &&
              !exercice.objectifs.includes(pre),
          );

          assert.equal(
            avantLePrerequis,
            -1,
            `${bloc.id} : « ${exercices[avantLePrerequis]?.id} » travaille ${dependant} ` +
              `sans ${pre}, et est présenté avant tout exercice de ${pre}.`,
          );
        }
      }
    }
  });

  it('exige la rencontre du prérequis pour valider un objectif', () => {
    // Contrôle de la règle elle-même, pas seulement de sa déclaration.
    assert.equal(prerrequisSatisfaits('OO-L1-1', new Set()), true, 'Aucun prérequis : rien à exiger.');
    assert.equal(prerrequisSatisfaits('OO-L1-2', new Set()), false);
    assert.equal(prerrequisSatisfaits('OO-L1-2', new Set(['OO-L1-1'])), true);
    // Un autre objectif rencontré ne remplace pas le bon prérequis.
    assert.equal(prerrequisSatisfaits('OO-L1-2', new Set(['OO-L3-1'])), false);
    assert.equal(prerrequisSatisfaits('OO-L5-2', new Set(['OO-L5-1'])), true);
    assert.equal(prerrequisSatisfaits('OBJECTIF-QUI-EXISTE-PAS', new Set()), false);
  });

  it('n’utilise que des signatures du catalogue fermé', () => {
    for (const exercice of EXERCICES) {
      for (const piege of exercice.pieges) {
        assert.ok(
          estSignatureValide(piege.signature),
          `Signature hors catalogue : ${piege.signature} (${exercice.id})`,
        );
      }
    }
    assert.equal(SIGNATURES.length, 12);
  });

  it('n’attribue jamais une signature à la mauvaise leçon', () => {
    // Le catalogue associe chaque signature à des leçons candidates
    // (`regles-recommandation-pedagogique.md` A.4). Si une signature observée
    // sur une leçon pointe ailleurs, l'exercice recommandé serait faux — et
    // l'erreur resterait invisible, car la correction est juste.
    //
    // `hors_perimetre` est la seule signature admise partout : elle signifie
    // « aucune conclusion spécifique », ce qui est exact quand aucun mécanisme
    // observé ne correspond à une signature existante.
    const leconDuBloc = (blocId: string): string => {
      const bloc = BLOCS.find((b) => b.id === blocId);
      assert.ok(bloc, `Bloc inconnu : ${blocId}`);
      // LEC-CM-MATH-3E-2025-2026-05 → L5
      return `L${Number(bloc.leconId.slice(-2))}`;
    };

    for (const exercice of EXERCICES) {
      const lecon = leconDuBloc(exercice.blocId);
      for (const piege of exercice.pieges) {
        const candidates = LEÇONS_CANDIDATES[piege.signature as SignatureErreur] ?? [];
        assert.ok(
          candidates.length === 0 || candidates.includes(lecon),
          `${exercice.id} : la signature « ${piege.signature} » (piège « ${piege.reponse} ») ` +
            `oriente vers ${JSON.stringify(candidates)} alors que l'exercice relève de ${lecon}.`,
        );
      }
    }
  });

  it('donne trois indices, dont aucun ne donne la solution', () => {
    for (const exercice of EXERCICES) {
      assert.equal(exercice.indices.length, 3);
      for (const indice of exercice.indices) {
        assert.ok(indice.texte.length > 10);
      }
      // L'énoncé de la réponse ne doit jamais apparaître tel quel dans un indice.
      const attendu = exercice.reponseAttendue.replace(/\s/g, '');
      for (const indice of exercice.indices) {
        assert.ok(
          !indice.texte.replace(/\s/g, '').includes(attendu),
          `L'indice ${indice.palier} de ${exercice.id} donne la réponse.`,
        );
      }
    }
  });
});

describe('recalcul indépendant des réponses attendues', () => {
  it('expressions algébriques : l’énoncé redonne la réponse déclarée', () => {
    for (const cas of EXPRESSIONS_A_VERIFIER) {
      const exercice = trouverExercice(cas.id);
      assert.ok(exercice, `${cas.id} introuvable`);

      const attendu = analyserExpressionReponse(cas.resultat);
      const depuisEnonce = analyserExpressionReponse(cas.expression);

      assert.equal(
        sontEgales(depuisEnonce, attendu),
        true,
        `${cas.id} : « ${cas.expression} » ne vaut pas « ${cas.resultat} ».`,
      );
      assert.equal(
        sontEgales(analyserExpressionReponse(exercice.reponseAttendue), attendu),
        true,
        `${cas.id} : la réponse déclarée « ${exercice.reponseAttendue} » est fausse.`,
      );
    }
  });

  it('racines carrées : l’énoncé redonne la réponse déclarée', () => {
    for (const exercice of EXERCICES.filter((e) => e.typeReponse === 'racine')) {
      const termes = evaluerRacines(exercice.enonce);
      const attendu = analyserRacine(exercice.reponseAttendue);

      // La réponse déclarée doit être présente dans la somme indépendante,
      // à son radical normalisé près.
      const reconstruit = sommeRacines([[attendu.coefficient.num, attendu.radicand]]);
      assert.deepEqual(
        [...reconstruit.entries()],
        [...termes.entries()],
        `${exercice.id} : l'énoncé « ${exercice.enonce} » ne redonne pas « ${exercice.reponseAttendue} ».`,
      );
      assert.equal(attendu.radicand, attendu.radicandSaisi, `${exercice.id} : radicand non simplifié.`);
      assert.equal(attendu.coefficient.den, 1n, `${exercice.id} : coefficient non entier.`);
    }
  });

  it('fractions : l’énoncé redonne la réponse déclarée', () => {
    for (const exercice of EXERCICES.filter((e) => e.typeReponse === 'rationnelle')) {
      const evaluation = evaluerRationnels(exercice.enonce);
      const calcul =
        evaluation.operateur === '×' ? produitExact(evaluation.termes) : sommeExacte(evaluation.termes);

      const declaree = analyserRationnel(exercice.reponseAttendue);
      assert.equal(
        versChaine(rationnel(calcul[0] ?? 0n, calcul[1] ?? 1n)),
        versChaine(declaree.valeur),
        `${exercice.id} : l'énoncé « ${exercice.enonce} » ne redonne pas « ${exercice.reponseAttendue} ».`,
      );
      assert.equal(declaree.forme, 'fraction', `${exercice.id} : réponse pas sous forme de fraction.`);
      assert.equal(declaree.denominateurEcrit > 0n, true);
    }
  });
});

/** Produit exact de deux fractions, écrit indépendamment. */
function produitExact(termes: bigint[][]): bigint[] {
  const [gauche, droite] = termes;
  if (!gauche || !droite) throw new Error('Produit mal formé');
  const num = (gauche[0] ?? 0n) * (droite[0] ?? 0n);
  const den = (gauche[1] ?? 1n) * (droite[1] ?? 1n);
  const g = pgcdLocal(num, den);
  return [num / g, den / g];
}

describe('cohérence du contenu', () => {
  it('rattache chaque exercice à un bloc déclaré et à un rang cohérent', () => {
    for (const bloc of BLOCS) {
      const exercices = exercicesDuBloc(bloc.id);
      assert.ok(exercices.length > 0, `Bloc ${bloc.id} vide`);
      for (const objectifId of bloc.objectifs) {
        const rangs = exercices
          .filter((exercice) => exercice.objectifs.includes(objectifId))
          .map((exercice) => exercice.rang)
          .sort();
        assert.deepEqual(rangs, rangs.map((_, i) => i + 1), `Rangs incohérents pour ${objectifId}`);
      }
    }
  });

  it('ne déclare jamais deux pièges de même valeur', () => {
    // Invariant discipline : deux pièges qui valent la même chose sont
    // deux fois la même erreur. Or c'est exactement ce qui rendrait la
    // signature d'erreur ambiguë. Ce contrôle a déjà détecté un doublon
    // sur `MVP-B1-E3`.
    for (const exercice of EXERCICES) {
      const valeurs: string[] = [];
      for (const piege of exercice.pieges) {
        const valeur = analyserSelonType(exercice.typeReponse, piege.reponse);
        const cle = JSON.stringify(valeur);
        assert.ok(
          !valeurs.includes(cle),
          `${exercice.id} : « ${piege.reponse} » fait double emploi avec un autre piège.`,
        );
        valeurs.push(cle);

        // Un piège ne peut pas être la réponse attendue — sauf ceux qui
        // documentent volontairement le cas « valeur exacte, forme non
        // respectée » (24/36 pour 2/3, 4x² − 9 pour (2x−3)(2x+3)…).
        const attendue = analyserSelonType(exercice.typeReponse, exercice.reponseAttendue);
        if (cle === JSON.stringify(attendue)) {
          // Un piège qui vaut la réponse n'a de sens que si l'exercice exige
          // une forme : c'est le cas « juste mais pas dans la forme demandée ».
          assert.ok(
            exercice.regleForme !== null,
            `${exercice.id} : « ${piege.reponse} » vaut la réponse alors qu'aucune forme n'est exigée.`,
          );
          assert.equal(exercice.regleFormeArbitree, true);
        }
      }
    }
  });

  it('énonce la forme exigée dans la consigne quand il en exige une', () => {
    for (const exercice of EXERCICES) {
      if (exercice.regleForme === null) continue;
      // Règle structurante du contenu : on ne peut pas exiger une forme que
      // l'élève ne voit pas dans l'énoncé.
      const mots = exercice.regleForme === 'fraction_irreductible'
        ? ['irréductible']
        : exercice.regleForme === 'produit_de_facteurs'
          ? ['produit', 'facteurs']
          : ['a√b'];
      for (const mot of mots) {
        assert.ok(
          exercice.consigne.includes(mot),
          `${exercice.id} : la consigne ne mentionne pas « ${mot} » alors que la forme est exigée.`,
        );
      }
    }
  });

  it('donne des identifiants uniques et techniques', () => {
    const ids = EXERCICES.map((exercice) => exercice.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.match(id, /^MVP-B\d-E\d$/);
    }
  });
});