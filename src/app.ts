import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from './config.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerCors } from './plugins/cors.js';
import { registerRoutes } from './routes/index.js';

/** Niveau de journalisation : silencieux sous test, verbeux en développement. */
function niveauDeLog(env: AppConfig['env']): string {
  if (env === 'test') return 'silent';
  return env === 'production' ? 'info' : 'debug';
}

/**
 * Construction de l'instance Fastify.
 *
 * Séparée de `server.ts` : elle ne fait QUE construire l'application et ne
 * démarre aucun listener. Cela la rend testable via `app.inject()` sans
 * ouvrir de port.
 */
export async function buildApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: niveauDeLog(config.env),
    },
    // Railway place l'app derrière un proxy : on fait confiance aux en-têtes
    // de transfert (X-Forwarded-*) pour obtenir la vraie IP et le protocole.
    trustProxy: true,
  });

  await registerCors(app, config);
  registerErrorHandler(app);
  registerRoutes(app);

  return app;
}