import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { DEBUT_ANNEE_DEFAUT } from '../src/lib/calendrier.js';

/**
 * `.env.example` doit décrire **toutes** les variables que le code lit.
 *
 * ## Le défaut
 *
 * `ANNEE_SCOLAIRE_DEBUT` et `DATE_NAVIGATION_TEST` étaient lues par
 * `src/routes/parcours.ts` sans apparaître dans `.env.example`. Un opérateur
 * qui configurait son déploiement depuis ce fichier n'avait aucun moyen de les
 * connaître.
 *
 * `DATE_NAVIGATION_TEST` est le cas dangereux : elle remplace la date réelle
 * dans `dateDuJour()`. Posée en production, elle **fige** la semaine affichée
 * pour toute l'application, et rien ne signale l'anomalie.
 *
 * Ce test compare le fichier d'exemple aux lectures réelles de
 * `process.env` dans les sources : la dérive ne peut plus se produire
 * silencieusement.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

const ENV_EXAMPLE = readFileSync(join(RACINE, '.env.example'), 'utf8');

/**
 * Les variables effectivement lues dans le code, hors test et hors documentation.
 *
 * Deux formes sont balayées : `process.env.X` (accès direct) et `env.X`, qui est
 * la forme utilisée par `loadConfig(env = process.env)`. Balayer la seconde
 * sans la première donnerait l'illusion d'une couverture complète alors que
 * `PORT`, `HOST`, `NODE_ENV` et `CORS_ORIGINS` ne seraient pas vus.
 */
function variablesLuesParLeCode(): Map<string, string[]> {
  const trouve = new Map<string, string[]>();
  for (const fichier of ['src/config.ts', 'src/routes/v1.ts', 'src/routes/parcours.ts']) {
    const source = readFileSync(join(RACINE, fichier), 'utf8');
    const motifs = [/process\.env\.([A-Z_]+)/g, /(?<!\.)\benv\.([A-Z_]+)/g];
    for (const motif of motifs) {
      for (const m of source.matchAll(motif)) {
        const liste = trouve.get(m[1]!) ?? [];
        liste.push(fichier);
        trouve.set(m[1]!, liste);
      }
    }
  }
  return trouve;
}

/** Une variable est-elle nommée ou expliquée dans `.env.example` ? */
function mentionneeDansLexemple(variable: string): boolean {
  const motif = new RegExp(`^\\s*#?\\s*${variable}\\b`, 'm');
  return motif.test(ENV_EXAMPLE);
}

const LUES = variablesLuesParLeCode();

describe('.env.example — couverture des variables lues par le code', () => {
  it('la lecture des sources est non vide', () => {
    // Garde-fou : un test qui ne trouve rien ne prouverait rien.
    assert.ok(LUES.size >= 4, `seulement ${LUES.size} variable(s) détectée(s)`);
  });

  it('les deux variables du calendrier sont lues par le code', () => {
    // Préalable : sans cela, les tests suivants ne prouveraient rien.
    assert.ok(LUES.has('ANNEE_SCOLAIRE_DEBUT'));
    assert.ok(LUES.has('DATE_NAVIGATION_TEST'));
  });

  it('`ANNEE_SCOLAIRE_DEBUT` est décrite dans `.env.example`', () => {
    assert.ok(
      mentionneeDansLexemple('ANNEE_SCOLAIRE_DEBUT'),
      'ANNEE_SCOLAIRE_DEBUT est lue par src/routes/parcours.ts mais absente de .env.example',
    );
  });

  it('`DATE_NAVIGATION_TEST` est décrite dans `.env.example`', () => {
    assert.ok(
      mentionneeDansLexemple('DATE_NAVIGATION_TEST'),
      'DATE_NAVIGATION_TEST est lue par src/routes/parcours.ts mais absente de .env.example',
    );
  });

  it('`DATE_NAVIGATION_TEST` porte un avertissement explicite sur le risque en production', () => {
    const position = ENV_EXAMPLE.indexOf('DATE_NAVIGATION_TEST');
    assert.ok(position > 0, 'DATE_NAVIGATION_TEST est absente du fichier');

    // Le commentaire qui accompagne la variable.
    const debut = ENV_EXAMPLE.lastIndexOf('\n#', position);
    const bloc = ENV_EXAMPLE.slice(Math.max(0, debut - 700), position + 200);

    assert.match(bloc, /TEST/i, 'l’avertissement doit rappeler que c’est une variable de test');
    assert.match(bloc, /production/i);
    assert.match(bloc, /fige/i);
  });

  it('`DATE_NAVIGATION_TEST` reste commentée dans l’exemple', () => {
    const ligne = ENV_EXAMPLE.split('\n').find((l) => l.includes('DATE_NAVIGATION_TEST='));
    assert.ok(ligne, 'la variable doit figurer dans .env.example');
    assert.ok(ligne.trimStart().startsWith('#'), 'elle doit rester commentée : le défaut est de ne pas la définir');
  });

  it('`ANNEE_SCOLAIRE_DEBUT` reste commentée dans l’exemple', () => {
    const ligne = ENV_EXAMPLE.split('\n').find((l) => l.includes('ANNEE_SCOLAIRE_DEBUT='));
    assert.ok(ligne, 'la variable doit figurer dans .env.example');
    assert.ok(ligne.trimStart().startsWith('#'));
  });

  it('l’exemple annonce la valeur par défaut réellement appliquée par le code', () => {
    // Un exemple qui annonce `2026-09-05` alors que le code applique
    // `2026-09-07` est une source d'erreur d'exploitation, pas de style.
    assert.match(ENV_EXAMPLE, new RegExp(`ANNEE_SCOLAIRE_DEBUT=${DEBUT_ANNEE_DEFAUT}`));
  });

  it('aucune variable lue par le code n’est absente de `.env.example`', () => {
    const absentes = [...LUES.keys()].filter((v) => !mentionneeDansLexemple(v)).sort();
    assert.deepEqual(
      absentes,
      [],
      `variables lues mais non documentées : ${absentes.join(', ')}`,
    );
  });

  it('`.env.example` ne définit aucune variable en production', () => {
    // Seules les variables d'infrastructure sont définies ; les variables
    // d Behaviour (calendrier, navigation) doivent rester commentées.
    const definies = ENV_EXAMPLE.split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split('=')[0]!);
    assert.deepEqual(definies.sort(), ['CORS_ORIGINS', 'HOST', 'NODE_ENV', 'PORT']);
  });
});