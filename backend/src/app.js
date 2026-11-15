import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config/env.js';
import { isDbConnected } from './config/db.js';
import { requestIdMiddleware } from './middleware/requestIdMiddleware.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import servicerRoutes from './routes/servicerRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

export function createApp() {
  const app = express();

  // Trust proxy for production reverse proxies (Railway, Nginx, Vercel)
  if (config.trustProxy) {
    app.set('trust proxy', config.trustProxy);
  }

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS allowlist with credentials
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = config.corsOrigins.some(allowed => {
        try {
          return new URL(allowed).origin === new URL(origin).origin;
        } catch {
          return false;
        }
      });
      if (isAllowed || !config.isProd) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
  }));

  app.use(cookieParser());
  app.use(express.json({
    limit: `${config.storage.maxUploadMb + 2}mb`,
    verify: (req, res, buf) => {
      // Preserve raw body buffer for webhook signature validation
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: `${config.storage.maxUploadMb + 2}mb` }));
  app.use(requestIdMiddleware);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const dbOk = isDbConnected();
    if (dbOk) {
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        appName: 'sifon-service',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      appName: 'sifon-service',
      timestamp: new Date().toISOString(),
    });
  });

  // Apply general rate limiter on API
  app.use('/api', apiLimiter);

  // API Domain Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/servicers', servicerRoutes);
  app.use('/api/brands', brandRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/complaints', complaintRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/settings/notifications', notificationRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // 404 handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        requestId: req.id,
      }
    });
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
}
