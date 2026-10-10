import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health.js';
import { registerV1Routes } from './v1.js';
import { registerParcoursRoutes } from './parcours.js';

/**
 * Point d'entrée unique des routes.
 *
 * Convention de versionnement : les routes métier sont préfixées par `/api/v1`.
 * `/health` reste hors version : c'est une sonde d'infrastructure, pas une
 * ressource métier, et elle ne doit pas casser lors d'un changement de version.
 */
export function registerRoutes(app: FastifyInstance): void {
  registerHealthRoutes(app);
  registerV1Routes(app);
  registerParcoursRoutes(app);
}