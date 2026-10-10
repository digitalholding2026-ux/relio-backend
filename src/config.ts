/**
 * Configuration de l'application, lue depuis l'environnement.
 *
 * Toute la lecture/validation est centralisée ici : le reste du code reçoit
 * un objet typé et ne touche jamais `process.env` directement.
 *
 * Règle de sécurité : CORS refuse le caractère joker `*` quand NODE_ENV=production.
 */

export type NodeEnv = 'development' | 'production' | 'test';

export interface AppConfig {
  /** Port d'écoute. Railway injecte PORT — ne jamais coder un port en dur. */
  port: number;
  /** Interface d'écoute. 0.0.0.0 obligatoire en conteneur pour être joignable. */
  host: string;
  env: NodeEnv;
  /** Origines autorisées pour CORS. Vide = aucun navigateur cross-origin accepté. */
  corsOrigins: string[];
  isProduction: boolean;
}

export class ConfigError extends Error {
  public constructor(message: string) {
    super(`Configuration invalide : ${message}`);
    this.name = 'ConfigError';
  }
}

function readPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    // 3000 est le défaut de développement. Railway fournit toujours PORT.
    return 3000;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`PORT doit être un entier entre 0 et 65535 (reçu : "${raw}").`);
  }
  return port;
}

function readNodeEnv(raw: string | undefined): NodeEnv {
  if (raw === undefined || raw === '') return 'development';
  if (raw === 'development' || raw === 'production' || raw === 'test') return raw;
  throw new ConfigError(
    `NODE_ENV doit valoir development, production ou test (reçu : "${raw}").`,
  );
}

function readCorsOrigins(raw: string | undefined, isProduction: boolean): string[] {
  if (raw === undefined || raw.trim() === '') return [];

  const origins = raw
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter((value) => value.length > 0);

  if (isProduction && origins.includes('*')) {
    throw new ConfigError(
      "CORS_ORIGINS ne doit pas contenir '*' en production. Utiliser une liste d'origines explicite.",
    );
  }

  const invalid = origins.filter((origin) => !/^https?:\/\/[^/\s]+$/.test(origin));
  if (invalid.length > 0) {
    throw new ConfigError(
      `CORS_ORIGINS contient des origines invalides : ${invalid.join(', ')}. ` +
        'Format attendu : https://exemple.com',
    );
  }

  return [...new Set(origins)];
}

/**
 * Construit la configuration à partir de l'environnement.
 * @throws {ConfigError} si une variable est absente ou invalide au démarrage.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = readNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === 'production';

  const port = readPort(env.PORT);
  const host = env.HOST?.trim() || '0.0.0.0';
  const corsOrigins = readCorsOrigins(env.CORS_ORIGINS, isProduction);

  return { port, host, env: nodeEnv, corsOrigins, isProduction };
}