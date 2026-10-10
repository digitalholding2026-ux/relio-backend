import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';

/**
 * CORS piloté par CORS_ORIGINS (liste d'origines séparées par des virgules).
 *
 * Choix de sécurité :
 * - aucune origine n'est autorisée si CORS_ORIGINS est vide ou absent ;
 * - le caractère joker `*` est refusé en production (validé dans config.ts) ;
 * - `origin` renvoie la liste exacte, ce qui fait qu'une origine inconnue
 *   reçoit une réponse SANS en-tête CORS — le navigateur la bloque.
 */
export async function registerCors(app: FastifyInstance, config: AppConfig): Promise<void> {
  const allowed = config.corsOrigins;

  await app.register(cors, {
    origin: (origin, callback) => {
      // Requête sans en-tête Origin : appel serveur à serveur, client curl,
      // sonde de plateforme Railway ou Vercel. Ce n'est pas un appel navigateur.
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalised = origin.replace(/\/$/, '');
      if (allowed.includes(normalised)) {
        callback(null, true);
        return;
      }

      // Pas d'erreur : on répond sans en-tête CORS. Le navigateur bloquera,
      // et la requête reste visible dans les journaux serveur.
      callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
    maxAge: 600,
  });

  if (allowed.length === 0) {
    app.log.warn(
      'CORS_ORIGINS est vide : aucun appel navigateur cross-origin ne sera accepté. ' +
        'Précisez la liste des origines autorisées.',
    );
  } else {
    app.log.info({ origins: allowed }, 'CORS activé');
  }
}