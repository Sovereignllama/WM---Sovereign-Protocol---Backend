import { Router, Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import multer from 'multer';
import { SovereignPage, Sovereign } from '../models';
import { config } from '../config';

const router = Router();

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// Multer for page image uploads (cover + gallery), max 2MB
const pageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, and WebP images are allowed'));
    }
  },
});

// ─── Wallet Signature Verification ───────────────────────────────────

interface AuthPayload {
  wallet: string;
  sovereignId: number;
  timestamp: number;
  signature: string; // base64-encoded
}

/**
 * Verify that a wallet signature is valid.
 * The message format is: "Edit Sovereign #<id> page at <timestamp>"
 * Timestamp must be within 5 minutes.
 */
async function verifyWalletAuth(body: AuthPayload): Promise<{ valid: boolean; error?: string }> {
  const { wallet, sovereignId, timestamp, signature } = body;

  if (!wallet || !sovereignId || !timestamp || !signature) {
    return { valid: false, error: 'Missing auth fields: wallet, sovereignId, timestamp, signature' };
  }

  // Check timestamp freshness (5 min window)
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return { valid: false, error: 'Signature expired. Please sign again.' };
  }

  // Reconstruct the signed message
  const message = `Edit Sovereign #${sovereignId} page at ${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);

  try {
    const pubkey = new PublicKey(wallet);
    const sigBytes = Buffer.from(signature, 'base64');

    // Use tweetnacl via @solana/web3.js internals — or import directly
    // PublicKey doesn't expose verify natively, so we use nacl
    const nacl = await import('tweetnacl');
    const verified = nacl.sign.detached.verify(messageBytes, sigBytes, pubkey.toBytes());

    if (!verified) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Signature verification failed' };
  }
}

/**
 * Auth middleware: verifies wallet owns the sovereign.
 * Expects body to contain: wallet, sovereignId, timestamp, signature
 */
async function requireCreatorAuth(req: Request, res: Response): Promise<boolean> {
  const { wallet, sovereignId, timestamp, signature } = req.body;

  // 1. Verify signature
  const auth = await verifyWalletAuth({ wallet, sovereignId, timestamp, signature });
  if (!auth.valid) {
    res.status(401).json({ error: auth.error });
    return false;
  }

  // 2. Verify this wallet is the creator of this sovereign
  const sovereign = await Sovereign.findOne({ sovereignId }).lean();
  if (!sovereign) {
    res.status(404).json({ error: 'Sovereign not found' });
    return false;
  }

  if (sovereign.creator !== wallet) {
    res.status(403).json({ error: 'Only the sovereign creator can edit this page' });
    return false;
  }

  return true;
}

// ─── Routes ──────────────────────────────────────────────────────────

/**
 * GET /api/sovereign-pages/:sovereignId
 * Public — fetch the customizable page data for a sovereign
 */
router.get('/:sovereignId', async (req: Request, res: Response) => {
  try {
    const sovereignId = parseInt(req.params.sovereignId, 10);
    if (isNaN(sovereignId)) {
      return res.status(400).json({ error: 'Invalid sovereignId' });
    }

    const page = await SovereignPage.findOne({ sovereignId }).lean();
    if (!page) {
      return res.json({ data: null }); // no custom page yet
    }

    return res.json({ data: page });
  } catch (error) {
    console.error('Error fetching sovereign page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/sovereign-pages/:sovereignId
 * Auth required — create or update the sovereign page
 * Body: { wallet, sovereignId, timestamp, signature, page: { summary, coverImage, gallery, videoEmbed, links, roadmap } }
 */
router.put('/:sovereignId', async (req: Request, res: Response) => {
  try {
    const sovereignId = parseInt(req.params.sovereignId, 10);
    if (isNaN(sovereignId)) {
      return res.status(400).json({ error: 'Invalid sovereignId' });
    }

    // Override body sovereignId with URL param for safety
    req.body.sovereignId = sovereignId;

    const authorized = await requireCreatorAuth(req, res);
    if (!authorized) return; // response already sent

    const { wallet, page } = req.body;

    if (!page || typeof page !== 'object') {
      return res.status(400).json({ error: 'Missing page data' });
    }

    // Validate + sanitize page fields
    const updateData: Record<string, unknown> = {
      creatorWallet: wallet,
    };

    if (page.summary !== undefined) {
      if (typeof page.summary !== 'string' || page.summary.length > 2000) {
        return res.status(400).json({ error: 'Summary must be a string under 2000 characters' });
      }
      updateData.summary = page.summary;
    }

    if (page.coverImage !== undefined) {
      updateData.coverImage = page.coverImage || '';
    }

    if (page.gallery !== undefined) {
      if (!Array.isArray(page.gallery) || page.gallery.length > 6) {
        return res.status(400).json({ error: 'Gallery must be an array of up to 6 items' });
      }
      updateData.gallery = page.gallery.map((item: any) => ({
        url: String(item.url || ''),
        caption: item.caption ? String(item.caption).slice(0, 120) : undefined,
      }));
    }

    if (page.videoEmbed !== undefined) {
      updateData.videoEmbed = page.videoEmbed || '';
    }

    if (page.links !== undefined) {
      const links: Record<string, unknown> = {};
      const linkFields = ['website', 'twitter', 'telegram', 'discord', 'github', 'docs'];
      for (const field of linkFields) {
        if (page.links[field] !== undefined) {
          links[field] = String(page.links[field] || '');
        }
      }
      if (page.links.custom && Array.isArray(page.links.custom)) {
        links.custom = page.links.custom.slice(0, 3).map((c: any) => ({
          label: String(c.label || '').slice(0, 40),
          url: String(c.url || ''),
        }));
      }
      updateData.links = links;
    }

    if (page.roadmap !== undefined) {
      if (!Array.isArray(page.roadmap) || page.roadmap.length > 8) {
        return res.status(400).json({ error: 'Roadmap must be an array of up to 8 milestones' });
      }
      const validStatuses = ['planned', 'in-progress', 'complete'];
      updateData.roadmap = page.roadmap.map((item: any) => ({
        title: String(item.title || '').slice(0, 80),
        description: item.description ? String(item.description).slice(0, 300) : undefined,
        status: validStatuses.includes(item.status) ? item.status : 'planned',
      }));
    }

    const result = await SovereignPage.findOneAndUpdate(
      { sovereignId },
      { $set: updateData },
      { upsert: true, new: true, runValidators: true }
    );

    return res.json({ data: result });
  } catch (error) {
    console.error('Error updating sovereign page:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sovereign-pages/:sovereignId/upload
 * Auth required — upload an image for cover or gallery
 * Multipart: file + wallet + sovereignId + timestamp + signature + type ('cover' | 'gallery')
 */
router.post('/:sovereignId/upload', pageUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const sovereignId = parseInt(req.params.sovereignId, 10);
    if (isNaN(sovereignId)) {
      return res.status(400).json({ error: 'Invalid sovereignId' });
    }

    req.body.sovereignId = sovereignId;

    const authorized = await requireCreatorAuth(req, res);
    if (!authorized) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!config.pinataJwt) {
      return res.status(500).json({ error: 'Pinata not configured on server' });
    }

    // Upload to IPFS via Pinata
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);

    const pinataRes = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.pinataJwt}` },
      body: formData,
    });

    if (!pinataRes.ok) {
      const error = await pinataRes.text();
      console.error('Pinata upload error:', error);
      return res.status(502).json({ error: 'Failed to upload to IPFS' });
    }

    const pinataResult = await pinataRes.json();
    const url = `${PINATA_GATEWAY}/${pinataResult.IpfsHash}`;

    return res.json({ url, ipfsHash: pinataResult.IpfsHash });
  } catch (error) {
    console.error('Error uploading page image:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
