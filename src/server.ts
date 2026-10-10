import { buildApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';

/**
 * Démarrage du serveur HTTP.
 *
 * PORT vient de l'environnement : Railway l'injecte à chaque déploiement.
 * Coder un port en dur ferait échouer le service.
 */
async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      // Erreur de configuration : on refuse de démarrer, avec un message clair.
      console.error(`[relio-backend] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const app = await buildApp(config);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Arrêt en cours');
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Erreur lors de l’arrêt');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    // 0.0.0.0 : indispensable en conteneur, sinon Railway ne peut pas joindre
    // le service depuis l'extérieur du conteneur.
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      { port: config.port, host: config.host, env: config.env },
      'relio-backend démarré',
    );
  } catch (error) {
    app.log.error({ err: error }, 'Échec du démarrage');
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('[relio-backend] Erreur fatale au démarrage', error);
  process.exit(1);
});