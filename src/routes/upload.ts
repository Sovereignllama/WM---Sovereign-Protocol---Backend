import { Router, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config';

const router = Router();

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// Configure multer for in-memory file uploads (max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/upload/image
 * Upload an image file to IPFS via Pinata
 * Returns: { url: string } - the IPFS gateway URL
 */
router.post('/image', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!config.pinataJwt) {
      return res.status(500).json({ error: 'Pinata not configured on server' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Build FormData for Pinata
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);

    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.pinataJwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Pinata file upload error:', error);
      return res.status(502).json({ error: 'Failed to upload image to IPFS' });
    }

    const result = await response.json() as { IpfsHash: string };
    const url = `${PINATA_GATEWAY}/${result.IpfsHash}`;

    return res.json({ url, ipfsHash: result.IpfsHash });
  } catch (error) {
    console.error('Upload image error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/upload/metadata
 * Upload token metadata JSON to IPFS via Pinata
 * Body: { name, symbol, description?, imageUrl }
 * Returns: { url: string } - the IPFS gateway URL for the metadata
 */
router.post('/metadata', async (req: Request, res: Response) => {
  try {
    if (!config.pinataJwt) {
      return res.status(500).json({ error: 'Pinata not configured on server' });
    }

    const { name, symbol, description, imageUrl } = req.body;

    if (!name || !symbol || !imageUrl) {
      return res.status(400).json({ error: 'name, symbol, and imageUrl are required' });
    }

    // Build Metaplex-compatible metadata
    const metadata = {
      name,
      symbol,
      description: description || `${name} (${symbol}) - A Sovereign Liquidity Protocol token`,
      image: imageUrl,
      properties: {
        files: [{ uri: imageUrl, type: 'image' }],
        category: 'image',
      },
    };

    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.pinataJwt}`,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: { name: `${symbol}-metadata.json` },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Pinata metadata upload error:', error);
      return res.status(502).json({ error: 'Failed to upload metadata to IPFS' });
    }

    const result = await response.json() as { IpfsHash: string };
    const url = `${PINATA_GATEWAY}/${result.IpfsHash}`;

    return res.json({ url, ipfsHash: result.IpfsHash });
  } catch (error) {
    console.error('Upload metadata error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
