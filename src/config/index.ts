import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sovereign-protocol',
  
  // Gorbagana
  rpcUrl: process.env.GORBAGANA_RPC_URL || 'https://rpc.trashscan.io',
  programId: process.env.PROGRAM_ID || '',
  
  // Webhooks
  heliusWebhookSecret: process.env.HELIUS_WEBHOOK_SECRET || '',
  
  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
} as const;
