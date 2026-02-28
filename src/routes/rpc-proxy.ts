import { Router, Request, Response } from 'express';
import express from 'express';
import { config } from '../config';

const router = Router();

// ── Allowed JSON-RPC methods (read-only + essential signing) ──
const ALLOWED_RPC_METHODS = new Set([
  // Account reads
  'getAccountInfo',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getTokenAccountsByDelegate',
  'getTokenSupply',
  // Transaction reads
  'getTransaction',
  'getSignaturesForAddress',
  'getSignatureStatuses',
  // Block/slot info
  'getLatestBlockhash',
  'getBlockHeight',
  'getSlot',
  'getEpochInfo',
  'getHealth',
  'getVersion',
  'getMinimumBalanceForRentExemption',
  'getFeeForMessage',
  // Sending transactions (user-signed)
  'sendTransaction',
  'simulateTransaction',
  // Balance
  'getBalance',
]);

// Tighter body limit for RPC proxy (50KB max — normal RPC calls are tiny)
const rpcBodyLimit = express.json({ limit: '50kb' });

/**
 * POST /api/rpc
 * Proxies JSON-RPC requests to the dedicated Gorbagana RPC node.
 * Keeps the API key server-side — frontend never sees it.
 * Falls back to backup RPC on failure.
 */
router.post('/', rpcBodyLimit, async (req: Request, res: Response) => {
  try {
    // ── Validate JSON-RPC method ──
    const { method } = req.body || {};
    if (!method || typeof method !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid JSON-RPC method' });
    }
    if (!ALLOWED_RPC_METHODS.has(method)) {
      return res.status(403).json({ error: `RPC method "${method}" is not allowed` });
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.rpcApiKey) {
      headers['Authorization'] = `Bearer ${config.rpcApiKey}`;
    }

    // Try primary RPC
    let response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    // Fallback to backup on failure
    if (!response.ok && config.backupRpcUrl) {
      console.warn(`[RPC Proxy] Primary RPC returned ${response.status}, falling back to backup`);
      response = await fetch(config.backupRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
    }

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[RPC Proxy] Error:', (error as Error).message);

    // Try backup on network error
    if (config.backupRpcUrl) {
      try {
        const backupResponse = await fetch(config.backupRpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body),
        });
        const data = await backupResponse.json();
        return res.status(backupResponse.status).json(data);
      } catch (backupError) {
        console.error('[RPC Proxy] Backup also failed:', (backupError as Error).message);
      }
    }

    return res.status(502).json({ error: 'RPC proxy error' });
  }
});

export default router;
