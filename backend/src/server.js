import { createApp } from './app.js';
import { config, validateConfig } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { ensureUploadDir } from './services/storageService.js';
import { startWhatsAppOutboxWorker, stopWhatsAppOutboxWorker } from './services/whatsappService.js';

async function startServer() {
  try {
    validateConfig();
    ensureUploadDir();

    console.log('[Server] Connecting to MongoDB...');
    await connectDB();
    console.log('[Server] Database connected successfully.');

    // Automatic WhatsApp outbox worker disabled for manual Click-to-Chat "Send on WhatsApp" mode
    // startWhatsAppOutboxWorker(15000);
    console.log('[Server] Manual "Send on WhatsApp" mode active (Meta outbox worker disabled).');

    const app = createApp();

    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`[Server] sifon-service backend running on http://0.0.0.0:${config.port} (env: ${config.env})`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      stopWhatsAppOutboxWorker();
      server.close(async () => {
        try {
          await disconnectDB();
          console.log('[Server] MongoDB disconnected. Process exiting.');
          process.exit(0);
        } catch (err) {
          console.error('[Server] Error during disconnect:', err);
          process.exit(1);
        }
      });

      // Force exit after 10s if hung
      setTimeout(() => {
        console.error('[Server] Forcefully terminating after timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[Server] Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();

