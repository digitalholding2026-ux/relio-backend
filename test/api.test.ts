import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { buildApp } from '../src/app.js';
import { ConfigError, loadConfig } from '../src/config.js';

/**
 * Tests de l'API — jamais de contact avec la production.
 *
 * On utilise `app.inject()` de Fastify : la requête est dispatchée en mémoire,
 * **aucun port n'est ouvert** et aucun trafic ne sort.
 */

const configDeTest = {
  port: 0,
  host: '127.0.0.1',
  env: 'test' as const,
  corsOrigins: ['https://relio-frontend-one.vercel.app'],
  isProduction: false,
};

const instances: Array<{ close: () => Promise<unknown> }> = [];

async function appDeTest(surcharge?: Partial<typeof configDeTest>) {
  const app = await buildApp({ ...configDeTest, ...surcharge });
  instances.push(app);
  return app;
}

afterEach(async () => {
  while (instances.length > 0) {
    const app = instances.pop();
    if (app) await app.close();
  }
});

describe('GET /health', () => {
  it('renvoie 200 et le statut attendu', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({ method: 'GET', url: '/health' });

    assert.equal(reponse.statusCode, 200);
    assert.equal(reponse.headers['content-type']?.includes('application/json'), true);
  });

  it('renvoie la structure JSON attendue', async () => {
    const app = await appDeTest();

    const corps = (await app.inject({ method: 'GET', url: '/health' })).json();

    assert.equal(corps.status, 'ok');
    assert.equal(corps.name, 'relio-backend');
    assert.equal(typeof corps.version, 'string');
    assert.equal(typeof corps.environment, 'string');
    assert.equal(typeof corps.uptimeSeconds, 'number');
    // Horodatage ISO 8601
    assert.equal(Number.isNaN(Date.parse(corps.timestamp)), false);
  });

  it('ne divulgue ni secret ni variable d’environnement', async () => {
    const app = await appDeTest({ corsOrigins: ['https://secret-interne.example'] });

    const brut = (await app.inject({ method: 'GET', url: '/health' })).body;

    assert.equal(brut.includes('secret-interne'), false);
    assert.equal(brut.toLowerCase().includes('password'), false);
    assert.equal(brut.toLowerCase().includes('token'), false);
    assert.equal(brut.toLowerCase().includes('key'), false);
  });

  it('ne révèle pas la version de Node ni les dépendances', async () => {
    const app = await appDeTest();

    const brut = (await app.inject({ method: 'GET', url: '/health' })).body;

    assert.equal(brut.includes('node'), false);
    assert.equal(brut.includes('fastify'), false);
  });

  it('ne se déclenche qu’en lecture', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({ method: 'POST', url: '/health' });

    assert.equal(reponse.statusCode, 404);
  });
});

describe('GET /api/v1', () => {
  it('renvoie la version et le statut attendus', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({ method: 'GET', url: '/api/v1' });

    assert.equal(reponse.statusCode, 200);
    const corps = reponse.json();
    assert.equal(corps.apiVersion, 'v1');
    assert.equal(corps.name, 'relio-backend');
  });

  // Le statut a évolué de « socle » à « mvp-pedagogique » avec le chantier 7 :
  // l'API expose désormais des routes métier. C'est un changement de contrat
  // explicite, documenté dans docs/CONTRAT-API.md.
  it('annonce explicitement l’état de la fonctionnalité', async () => {
    const app = await appDeTest();

    const corps = (await app.inject({ method: 'GET', url: '/api/v1' })).json();

    assert.equal(corps.status, 'mvp-pedagogique');
  });

  it('documente les routes réellement exposées', async () => {
    const app = await appDeTest();

    const corps = (await app.inject({ method: 'GET', url: '/api/v1' })).json();

    const routes = corps.endpoints.map((e: { path: string }) => e.path).sort();
    assert.deepEqual(routes, [
      '/api/v1',
      '/api/v1/corrections',
      '/api/v1/exercices/:id',
      '/api/v1/exercices/:id/indice/:palier',
      '/api/v1/parcours',
      '/api/v1/progression',
      '/api/v1/suivi',
      '/health',
    ]);
  });
});

describe('routes inconnues', () => {
  it('renvoie 404 au format d’erreur commun', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({ method: 'GET', url: '/nexiste-pas' });

    assert.equal(reponse.statusCode, 404);
    assert.equal(reponse.json().error.code, 'NOT_FOUND');
  });

  it('ne renvoie pas de stack trace', async () => {
    const app = await appDeTest();

    const brut = (await app.inject({ method: 'GET', url: '/nexiste-pas' })).body;

    assert.equal(brut.includes('at '), false);
    assert.equal(brut.toLowerCase().includes('stack'), false);
  });
});

describe('erreurs contrôlées', () => {
  it('renvoie 400 avec un message neutralisé sur un JSON invalide', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({
      method: 'POST',
      url: '/api/v1',
      headers: { 'content-type': 'application/json' },
      payload: '{invalide',
    });

    assert.equal(reponse.statusCode, 400);
    assert.equal(reponse.json().error.message, 'Requête invalide.');
  });

  it('ne divulgue pas le message technique de la bibliothèque', async () => {
    const app = await appDeTest();

    const corps = (await app.inject({
      method: 'POST',
      url: '/api/v1',
      headers: { 'content-type': 'application/json' },
      payload: '{invalide',
    })).json();

    assert.equal(corps.error.message.includes('JSON'), false);
    assert.equal(corps.error.message.includes('content-type'), false);
  });

  it('garde le même format d’erreur pour toutes les erreurs', async () => {
    const app = await appDeTest();

    const cas = [
      await app.inject({ method: 'GET', url: '/inconnue' }),
      await app.inject({
        method: 'POST',
        url: '/api/v1',
        headers: { 'content-type': 'application/json' },
        payload: '{',
      }),
    ];

    for (const reponse of cas) {
      const corps = reponse.json();
      assert.ok(corps.error, 'le champ error doit être présent');
      assert.equal(typeof corps.error.code, 'string');
      assert.equal(typeof corps.error.message, 'string');
    }
  });
});

describe('CORS', () => {
  it('autorise l’origine configurée', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({
      method: 'GET',
      url: '/api/v1',
      headers: { origin: 'https://relio-frontend-one.vercel.app' },
    });

    assert.equal(
      reponse.headers['access-control-allow-origin'],
      'https://relio-frontend-one.vercel.app',
    );
  });

  it('refuse une origine non configurée', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({
      method: 'GET',
      url: '/api/v1',
      headers: { origin: 'https://attaquant.example' },
    });

    assert.equal(reponse.headers['access-control-allow-origin'], undefined);
  });

  it('refuse une origine qui usurpe le suffixe du frontend', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({
      method: 'GET',
      url: '/api/v1',
      headers: { origin: 'https://relio-frontend-one.vercel.app.attaquant.example' },
    });

    assert.equal(reponse.headers['access-control-allow-origin'], undefined);
  });

  it('n’autorise rien si la liste est vide', async () => {
    const app = await appDeTest({ corsOrigins: [] });

    const reponse = await app.inject({
      method: 'GET',
      url: '/api/v1',
      headers: { origin: 'https://relio-frontend-one.vercel.app' },
    });

    assert.equal(reponse.headers['access-control-allow-origin'], undefined);
  });

  it('accepte une requête sans en-tête Origin (sonde de plateforme)', async () => {
    const app = await appDeTest();

    const reponse = await app.inject({ method: 'GET', url: '/api/v1' });

    assert.equal(reponse.statusCode, 200);
  });
});

describe('loadConfig', () => {
  const base = { ...process.env };

  it('applique des valeurs par défaut', () => {
    const config = loadConfig({});

    assert.equal(config.port, 3000);
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.env, 'development');
    assert.deepEqual(config.corsOrigins, []);
  });

  it('refuse un PORT non entier', () => {
    assert.throws(() => loadConfig({ ...base, PORT: 'abc' }), ConfigError);
  });

  it('refuse un PORT hors plage', () => {
    assert.throws(() => loadConfig({ ...base, PORT: '70000' }), ConfigError);
    assert.throws(() => loadConfig({ ...base, PORT: '-1' }), ConfigError);
  });

  it('lit le PORT fourni par la plateforme', () => {
    assert.equal(loadConfig({ ...base, PORT: '8080' }).port, 8080);
  });

  it('refuse un NODE_ENV inconnu', () => {
    assert.throws(() => loadConfig({ ...base, NODE_ENV: 'productionn' }), ConfigError);
  });

  it('refuse le caractère joker en production', () => {
    assert.throws(
      () => loadConfig({ ...base, NODE_ENV: 'production', CORS_ORIGINS: '*' }),
      ConfigError,
    );
  });

  it('accepte une liste d’origines explicite en production', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://a.example, https://b.example/',
    });

    assert.deepEqual(config.corsOrigins, ['https://a.example', 'https://b.example']);
    assert.equal(config.isProduction, true);
  });

  it('refuse une origine mal formée', () => {
    assert.throws(
      () => loadConfig({ ...base, CORS_ORIGINS: 'pas-une-url' }),
      ConfigError,
    );
  });

  it('déduplique les origines', () => {
    const config = loadConfig({ ...base, CORS_ORIGINS: 'https://a.example,https://a.example' });

    assert.deepEqual(config.corsOrigins, ['https://a.example']);
  });
});