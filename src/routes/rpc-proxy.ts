import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

/**
 * POST /api/rpc
 * Proxies JSON-RPC requests to the dedicated Gorbagana RPC node.
 * Keeps the API key server-side — frontend never sees it.
 * Falls back to backup RPC on failure.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
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
