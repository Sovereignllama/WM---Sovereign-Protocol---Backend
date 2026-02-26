import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sovereign-protocol',
  
  // Gorbagana
  rpcUrl: process.env.GORBAGANA_RPC_URL || 'https://rpc.trashscan.io',
  rpcApiKey: process.env.GORBAGANA_RPC_API_KEY || '',
  backupRpcUrl: process.env.GORBAGANA_BACKUP_RPC_URL || 'https://rpc.trashscan.io',
  programId: process.env.PROGRAM_ID || '',
  
  // Pinata IPFS
  pinataJwt: process.env.PINATA_JWT || '',

  // NFT Metadata images
  collectionImageUrl: process.env.COLLECTION_IMAGE_URL || '',
  defaultNftImageUrl: process.env.DEFAULT_NFT_IMAGE_URL || '',
  
  // Webhooks
  heliusWebhookSecret: process.env.HELIUS_WEBHOOK_SECRET || '',
  
  // Pool Price Worker
  poolPriceWorkerUrl: process.env.POOL_PRICE_WORKER_URL || 'https://waste-management-pool-price-tracker.onrender.com',

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
} as const;
