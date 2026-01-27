import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { connectDatabase } from './config/database';
import apiRoutes from './routes';
import webhookRoutes from './routes/webhook';

async function main() {
  // Connect to MongoDB
  await connectDatabase();

  const app = express();

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
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
