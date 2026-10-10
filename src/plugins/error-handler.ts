import type { FastifyError, FastifyInstance } from 'fastify';
import { ApiError, toApiErrorBody } from '../lib/errors.js';

/**
 * Gestionnaire d'erreurs centralisé.
 *
 * - `ApiError` → statut et message maîtrisés
 * - erreur 4xx de Fastify → renvoyée telle quelle, au format commun
 * - tout le reste → 500 avec un message générique (jamais de détail technique)
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(toApiErrorBody(error));
    }

    // Erreur attendue de Fastify (ex. 404 de route par défaut).
    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;

    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: 'BAD_REQUEST', message: error.message },
      });
    }

    // 500 : on journalise côté serveur, on ne divulgue rien au client.
    request.log.error({ err: error }, 'Erreur non gérée');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route inconnue : ${request.method} ${request.url}`,
      },
    });
  });
}