import type { FastifyInstance } from 'fastify';

/** Version du contrat d'API. Incrémentée à chaque changement incompatible. */
export const API_VERSION = 'v1';

export const API_NAME = 'relio-backend';
export const API_STATUS = 'socle' as const;

export interface HealthResponse {
  status: 'ok';
  name: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ApiInfoResponse {
  name: string;
  apiVersion: string;
  status: typeof API_STATUS;
  documentation: string;
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
  }>;
}

/**
 * Sonde d'infrastructure.
 *
 * Volontairement publique, rapide et sans dépendance : c'est ce que Railway
 * et Vercel interrogent pour savoir si le service est vivant.
 *
 * Elle ne doit divulguer ni version de dépendance, ni variable
 * d'environnement, ni secret.
 */
export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/health', async (_request, reply) => {
    const body: HealthResponse = {
      status: 'ok',
      name: API_NAME,
      version: process.env.npm_package_version ?? '0.1.0',
      environment: process.env.NODE_ENV ?? 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    return reply.status(200).send(body);
  });
}

/**
 * Point d'entrée versionné : documente ce que l'API sait faire aujourd'hui.
 *
 * `status: "socle"` rappelle explicitement qu'aucune fonctionnalité
 * pédagogique n'est implémentée. Le frontend s'appuie sur ce champ pour
 * distinguer « API joignable » de « fonctionnalité disponible ».
 */
export function registerV1Routes(app: FastifyInstance): void {
  app.get('/api/v1', async (_request, reply) => {
    const body: ApiInfoResponse = {
      name: API_NAME,
      apiVersion: API_VERSION,
      status: API_STATUS,
      documentation: 'voir docs/CONTRAT-API.md dans le dépôt, et openapi.yaml',
      endpoints: [
        { method: 'GET', path: '/health', description: 'Sonde de disponibilité.' },
        { method: 'GET', path: '/api/v1', description: 'Version et état de l’API.' },
      ],
    };

    return reply.status(200).send(body);
  });
}