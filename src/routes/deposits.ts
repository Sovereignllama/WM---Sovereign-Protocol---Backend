import { Router, Request, Response } from 'express';
import { Deposit, GenesisNFT, Sovereign } from '../models';

const router = Router();

// GET /api/deposits - List deposits with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      sovereign, 
      depositor,
      page = '1', 
      limit = '20',
    } = req.query;

    const query: Record<string, unknown> = {};
    
    if (sovereign) {
      query.sovereign = sovereign;
    }
    
    if (depositor) {
      query.depositor = depositor;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [deposits, total] = await Promise.all([
      Deposit.find(query)
        .sort('-createdAt')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Deposit.countDocuments(query),
    ]);

    res.json({
      data: deposits,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching deposits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/deposits/user/:wallet - Get all deposits for a user
router.get('/user/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    
    const deposits = await Deposit.find({ depositor: wallet })
      .sort('-createdAt')
      .lean();

    // Get sovereign details for each deposit
    const sovereignIds = [...new Set(deposits.map(d => d.sovereign))];
    const sovereigns = await Sovereign.find({ 
      publicKey: { $in: sovereignIds } 
    }).lean();

    const sovereignMap = new Map(sovereigns.map(s => [s.publicKey, s]));

    const depositsWithSovereign = deposits.map(d => ({
      ...d,
      sovereignDetails: sovereignMap.get(d.sovereign),
    }));

    res.json(depositsWithSovereign);
  } catch (error) {
    console.error('Error fetching user deposits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/deposits/:sovereign/:depositor - Get specific deposit
router.get('/:sovereign/:depositor', async (req: Request, res: Response) => {
  try {
    const { sovereign, depositor } = req.params;
    
    const deposit = await Deposit.findOne({ sovereign, depositor }).lean();

    if (!deposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }

    res.json(deposit);
  } catch (error) {
    console.error('Error fetching deposit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
