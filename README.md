# Sovereign Protocol Backend

Backend API for the Sovereign Liquidity Protocol on Gorbagana (Solana fork).

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Language**: TypeScript
- **Hosting**: Render

## Features

- RESTful API for sovereigns, deposits, NFTs, proposals, and events
- Helius webhook integration for real-time indexing
- Rate limiting and security headers
- CORS configuration for frontend

## API Endpoints

### Sovereigns
- `GET /api/sovereigns` - List all sovereigns (with filters)
- `GET /api/sovereigns/stats` - Protocol statistics
- `GET /api/sovereigns/:id` - Get single sovereign

### Deposits
- `GET /api/deposits` - List deposits
- `GET /api/deposits/user/:wallet` - Get user's deposits
- `GET /api/deposits/:sovereign/:depositor` - Get specific deposit

### Genesis NFTs
- `GET /api/nfts` - List NFTs
- `GET /api/nfts/owner/:wallet` - Get user's NFTs
- `GET /api/nfts/:mint` - Get NFT by mint

### Proposals
- `GET /api/proposals` - List proposals
- `GET /api/proposals/active` - Get active proposals
- `GET /api/proposals/:id` - Get proposal details

### Events
- `GET /api/events` - List events
- `GET /api/events/recent` - Get recent events
- `GET /api/events/sovereign/:sovereign` - Get sovereign events

### Webhooks
- `POST /webhook/helius` - Helius webhook receiver

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `MONGODB_URI` - MongoDB connection string
- `GORBAGANA_RPC_URL` - Gorbagana RPC endpoint
- `HELIUS_WEBHOOK_SECRET` - Secret for webhook verification

### 3. Run development server

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build
npm start
```

## Render Deployment

### render.yaml

```yaml
services:
  - type: web
    name: sovereign-protocol-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: HELIUS_WEBHOOK_SECRET
        sync: false
```

## Helius Webhook Setup

1. Go to [Helius Dashboard](https://dashboard.helius.dev)
2. Create a new webhook
3. Set the webhook URL to: `https://your-api.render.com/webhook/helius`
4. Select "Enhanced Transactions" type
5. Add your program ID to track
6. Copy the webhook secret to your `.env`

## Database Schema

### Collections

- **sovereigns** - Sovereign state and configuration
- **deposits** - Investor deposit records
- **genesisnfts** - Genesis NFT ownership and metadata
- **proposals** - Governance proposals
- **events** - Transaction event log (append-only)

## License

MIT
