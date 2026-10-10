import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  estCarreParfait,
  estEgal,
  estEntier,
  facteursPremiers,
  oppose,
  produit,
  quotient,
  rationnel,
  racineCarreeEntiere,
  somme,
  versChaine,
  versNombre,
} from '../src/lib/algebre.js';
import {
  analyserExpression,
  comparerPolynomes,
  estProduitDeFacteurs,
  ExpressionRefusee,
  nombreDeTermes,
  sontAlgebriquementEgales,
  versPolynome,
} from '../src/lib/analyseur-expression.js';
import {
  analyserRacine,
  analyserRationnel,
  decrire,
  estIrreductible,
  sontEgales,
} from '../src/lib/analyseur-reponse.js';

/**
 * Tests du moteur de calcul exact.
 *
 * Aucun de ces tests ne dépend d'un réseau, d'un port ni de la production.
 * Ils vérifient la propriété centrale du chantier 7 : **une réponse
 * algébriquement équivalente à la réponse attendue n'est jamais déclarée fausse**.
 */

describe('rationnels exacts', () => {
  it('normalise et réduit', () => {
    assert.equal(versChaine(rationnel(14n, 12n)), '7/6');
    assert.equal(versChaine(rationnel(-6n, -8n)), '3/4');
    assert.equal(versChaine(rationnel(5n, 10n)), '1/2');
  });

  it('ne perd pas de précision là où un flottant en perdrait', () => {
    const tiers = rationnel(1n, 3n);
    // 1/3 est exact en rationnel ; son cumul reste exact après trois fois.
    assert.equal(versChaine(somme(somme(tiers, tiers), tiers)), '1');
  });

  it('gère les signes', () => {
    assert.equal(versChaine(oppose(rationnel(3n, 4n))), '-3/4');
    assert.equal(versChaine(quotient(rationnel(1n, -2n), rationnel(1n, 4n))), '-2');
  });

  it('refuse la division par zéro', () => {
    assert.throws(() => rationnel(1n, 0n));
    assert.throws(() => quotient(rationnel(1n, 2n), rationnel(0n)));
  });

  it('reconnaît les entiers et les carrés parfaits', () => {
    assert.equal(estEntier(rationnel(6n, 3n)), true);
    assert.equal(estEntier(rationnel(7n, 3n)), false);
    assert.equal(estCarreParfait(50n), false);
    assert.equal(estCarreParfait(49n), true);
    assert.equal(racineCarreeEntiere(72n), null);
    assert.deepEqual(facteursPremiers(72n), [2n, 2n, 2n, 3n, 3n]);
  });
});

describe('analyse d’expressions', () => {
  it('traite la multiplication implicite', () => {
    assert.equal(sontAlgebriquementEgales('2x', '2*x'), true);
    assert.equal(sontAlgebriquementEgales('3(x+1)', '3x + 3'), true);
    assert.equal(sontAlgebriquementEgales('(x+1)(x-2)', 'x^2 - x - 2'), true);
  });

  it('respecte les priorités et les parenthèses', () => {
    assert.equal(sontAlgebriquementEgales('2x^2', '(2x)(x)'), true);
    assert.equal(sontAlgebriquementEgales('2(x+3)^2', '2x^2 + 12x + 18'), true);
    assert.equal(sontAlgebriquementEgales('-x', '0 - x'), true);
    assert.equal(sontAlgebriquementEgales('(2x - 1)^2', '4x^2 - 4x + 1'), true);
  });

  it('distingue les expressions réellement différentes', () => {
    assert.equal(sontAlgebriquementEgales('7x + 11', '5x + 7'), false);
    assert.equal(sontAlgebriquementEgales('x^2 - x - 4', 'x^2 + x - 4'), false);
  });

  // ── Le cas central du chantier 6 (F1) ──────────────────────────────────
  it('reconnaît les écritures algébriquement équivalentes', () => {
    assert.equal(sontAlgebriquementEgales('(2x-2)(2x+4)', '4(x-1)(x+2)'), true);
    assert.equal(sontAlgebriquementEgales('4x^2 + 4x - 8', '(2x-2)(2x+4)'), true);
    assert.equal(sontAlgebriquementEgales('x(x-7)', 'x^2 - 7x'), true);
    assert.equal(sontAlgebriquementEgales('(3x-1)(x+2)', '3x^2+5x-2'), true);
  });

  it('gère la division par une constante exacte', () => {
    assert.equal(sontAlgebriquementEgales('x/2', '0.5x'), true);
    assert.equal(sontAlgebriquementEgales('(2x+1)/2', 'x + 1/2'), true);
  });

  it('refuse plutôt que de deviner', () => {
    // L'analyse syntaxique accepte la division ; c'est l'évaluation en
    // polynôme qui refuse, car le résultat ne serait plus un polynôme.
    assert.throws(() => versPolynome('x/(x+1)'), ExpressionRefusee);
    assert.throws(() => versPolynome('1/0'), ExpressionRefusee);
    assert.throws(() => analyserExpression('x^'), ExpressionRefusee);
    assert.throws(() => analyserExpression('(x+1'), ExpressionRefusee);
    assert.throws(() => analyserExpression(''), ExpressionRefusee);
    assert.throws(() => analyserExpression('2 @ 3'), ExpressionRefusee);
    assert.throws(() => analyserExpression('x^99'), ExpressionRefusee);
  });

  it('reconnaît la forme « produit de facteurs »', () => {
    assert.equal(estProduitDeFacteurs(analyserExpression('(2x-3)(2x+3)')), true);
    assert.equal(estProduitDeFacteurs(analyserExpression('x(x-7)')), true);
    assert.equal(estProduitDeFacteurs(analyserExpression('4(x-1)(x+2)')), true);
    assert.equal(estProduitDeFacteurs(analyserExpression('x^2 + x - 6')), false);
    assert.equal(estProduitDeFacteurs(analyserExpression('4x^2 + 4x - 8')), false);
  });

  it('compte les termes d’une somme', () => {
    assert.equal(nombreDeTermes(analyserExpression('x^2 - x - 4')), 3);
    assert.equal(nombreDeTermes(analyserExpression('2x + 1')), 2);
  });

  it('compare des polynômes déjà calculés', () => {
    assert.equal(comparerPolynomes(versPolynome('3x + 1'), versPolynome('1 + 3x')), true);
  });
});

describe('analyse de réponses', () => {
  it('lit les fractions et les nombres', () => {
    assert.equal(versChaine(analyserRationnel('7/6').valeur), '7/6');
    assert.equal(versChaine(analyserRationnel('-7/6').valeur), '-7/6');
    assert.equal(versChaine(analyserRationnel('0.5').valeur), '1/2');
    assert.equal(versChaine(analyserRationnel('1,5').valeur), '3/2');
    assert.equal(analyserRationnel('7/6').forme, 'fraction');
    assert.equal(analyserRationnel('7').forme, 'entiere');
    assert.equal(analyserRationnel('1.5').forme, 'decimale');
  });

  it('distingue 14/12 de 7/6 sur la forme, jamais sur la valeur', () => {
    const reduite = analyserRationnel('7/6');
    const nonReduite = analyserRationnel('14/12');
    // Même valeur : la justesse mathématique est identique.
    assert.equal(estEgal(reduite.valeur, nonReduite.valeur), true);
    assert.equal(sontEgales(reduite, nonReduite), true);
    // Formes différentes : c'est le second jugement qui les sépare.
    assert.equal(estIrreductible(reduite), true);
    assert.equal(estIrreductible(nonReduite), false);
  });

  it('normalise les racines carrées', () => {
    assert.equal(analyserRacine('5√2').radicand, 2);
    assert.equal(versChaine(analyserRacine('5√2').coefficient), '5');
    assert.equal(versChaine(analyserRacine('√72').coefficient), '6');
    assert.equal(analyserRacine('√72').radicand, 2);
    assert.equal(analyserRacine('50√2').radicand, 2);
    assert.equal(versChaine(analyserRacine('-√8').coefficient), '-2');
  });

  it('compare les racines par valeur, pas par écriture', () => {
    assert.equal(sontEgales(analyserRacine('3√3'), analyserRacine('3√3')), true);
    // 6√8 et 12√2 sont la même valeur.
    assert.equal(sontEgales(analyserRacine('6√8'), analyserRacine('12√2')), true);
    // 50√2 n'est PAS 5√2 : c'est exactement là que se joue le piège.
    assert.equal(sontEgales(analyserRacine('50√2'), analyserRacine('5√2')), false);
    assert.equal(sontEgales(analyserRacine('11√3'), analyserRacine('11√2')), false);
  });

  it('refuse une réponse illisible', () => {
    assert.throws(() => analyserRationnel('bonjour'));
    assert.throws(() => analyserRacine('3x'));
    assert.throws(() => analyserRacine(''));
  });

  it('décrit une valeur pour les journaux', () => {
    assert.match(decrire(analyserRacine('5√2')), /5√2/);
  });
});