import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { config } from './config';
import { connectDatabase } from './config/database';
import apiRoutes from './routes';
import webhookRoutes from './routes/webhook';
import { startChainSync } from './services/chain-sync';

async function main() {
  // Connect to MongoDB
  await connectDatabase();

  const app = express();

  // Trust reverse proxy (Render, etc.) for correct client IP in rate limiter
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  
  // CORS
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api', limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));

  // Sanitize MongoDB queries — strips $-prefixed keys from req.body/query/params
  app.use(mongoSanitize());

  // Routes
  app.use('/api', apiRoutes);
  app.use('/webhook', webhookRoutes);

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      name: 'Sovereign Protocol API',
      version: '1.0.0',
      status: 'running',
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Start server
  app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║       Sovereign Protocol API Server                    ║
╠═══════════════════════════════════════════════════════╣
║  Port:        ${config.port.toString().padEnd(40)}║
║  Environment: ${config.nodeEnv.padEnd(40)}║
║  RPC:         ${config.rpcUrl.substring(0, 38).padEnd(40)}║
╚═══════════════════════════════════════════════════════╝
    `);

    // Start chain sync after server is listening (60s interval)
    startChainSync(60_000);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
