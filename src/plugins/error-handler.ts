import type { FastifyError, FastifyInstance } from 'fastify';
import { ApiError, toApiErrorBody } from '../lib/errors.js';

/**
 * Messages génériques par statut.
 *
 * Les erreurs 4xx générées par Fastify portent un message technique
 * (« Body is not valid JSON but content-type is set to 'application/json' »)
 * qui révèle la bibliothèque employée. Elles sont donc remplacées par un
 * message neutre.
 *
 * Le message détaillé reste dans les journaux serveur, jamais dans la réponse.
 */
const MESSAGES_CLIENT: Record<number, string> = {
  400: 'Requête invalide.',
  404: 'Ressource introuvable.',
  413: 'Requête trop volumineuse.',
  415: 'Type de contenu non supporté.',
  429: 'Trop de requêtes. Réessayez plus tard.',
};

/** Message sûr pour un statut 4xx sans entrée dédiée. */
function messagePourStatut(statusCode: number): string {
  return MESSAGES_CLIENT[statusCode] ?? 'Requête invalide.';
}

/**
 * Gestionnaire d'erreurs centralisé.
 *
 * - `ApiError` → statut et message maîtrisés par le code applicatif
 * - erreur 4xx de Fastify → statut conservé, **message neutralisé**
 * - tout le reste → 500 avec un message générique, jamais de détail technique
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(toApiErrorBody(error));
    }

    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;

    if (statusCode >= 400 && statusCode < 500) {
      // Détail utile côté serveur uniquement.
      request.log.info({ err: error, statusCode }, 'Requête rejetée');
      return reply.status(statusCode).send({
        error: { code: 'BAD_REQUEST', message: messagePourStatut(statusCode) },
      });
    }

    // 500 : journalisé côté serveur, rien de technique renvoyé au client.
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