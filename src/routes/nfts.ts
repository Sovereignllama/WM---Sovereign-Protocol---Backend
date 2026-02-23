import { Router, Request, Response } from 'express';
import { GenesisNFT, Sovereign } from '../models';

const router = Router();

// GET /api/nfts/counts - NFT minted counts per sovereign (batch)
router.get('/counts', async (_req: Request, res: Response) => {
  try {
    const counts = await GenesisNFT.aggregate([
      { $group: { _id: '$sovereign', count: { $sum: 1 } } },
    ]);
    const result: Record<string, number> = {};
    for (const c of counts) {
      result[c._id] = c.count;
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching NFT counts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nfts - List NFTs with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      sovereign, 
      owner,
      page = '1', 
      limit = '20',
    } = req.query;

    const query: Record<string, unknown> = {};
    
    if (sovereign) {
      query.sovereign = sovereign;
    }
    
    if (owner) {
      query.owner = owner;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [nfts, total] = await Promise.all([
      GenesisNFT.find(query)
        .sort('-mintedAt')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      GenesisNFT.countDocuments(query),
    ]);

    res.json({
      data: nfts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nfts/owner/:wallet - Get all NFTs owned by a wallet
router.get('/owner/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    
    const nfts = await GenesisNFT.find({ owner: wallet })
      .sort('-mintedAt')
      .lean();

    // Get sovereign details for each NFT
    const sovereignIds = [...new Set(nfts.map(n => n.sovereign))];
    const sovereigns = await Sovereign.find({ 
      publicKey: { $in: sovereignIds } 
    }).lean();

    const sovereignMap = new Map(sovereigns.map(s => [s.publicKey, s]));

    const nftsWithSovereign = nfts.map(n => ({
      ...n,
      sovereignDetails: sovereignMap.get(n.sovereign),
    }));

    res.json(nftsWithSovereign);
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nfts/:mint - Get NFT by mint address
router.get('/:mint', async (req: Request, res: Response) => {
  try {
    const { mint } = req.params;
    
    const nft = await GenesisNFT.findOne({ mint }).lean();

    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    // Get sovereign details
    const sovereign = await Sovereign.findOne({ publicKey: nft.sovereign }).lean();

    res.json({
      ...nft,
      sovereignDetails: sovereign,
    });
  } catch (error) {
    console.error('Error fetching NFT:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
