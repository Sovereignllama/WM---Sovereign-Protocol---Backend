import { Router, Request, Response } from 'express';
import { Proposal, Sovereign } from '../models';

const router = Router();

// GET /api/proposals - List proposals with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      sovereign, 
      status,
      proposer,
      page = '1', 
      limit = '20',
    } = req.query;

    const query: Record<string, unknown> = {};
    
    if (sovereign) {
      query.sovereign = sovereign;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (proposer) {
      query.proposer = proposer;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [proposals, total] = await Promise.all([
      Proposal.find(query)
        .sort('-createdAt')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Proposal.countDocuments(query),
    ]);

    res.json({
      data: proposals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/proposals/active - Get all active proposals
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const proposals = await Proposal.find({ 
      status: 'Active',
      endTime: { $gt: new Date() }
    })
    .sort('endTime')
    .lean();

    // Get sovereign details
    const sovereignIds = [...new Set(proposals.map(p => p.sovereign))];
    const sovereigns = await Sovereign.find({ 
      publicKey: { $in: sovereignIds } 
    }).lean();

    const sovereignMap = new Map(sovereigns.map(s => [s.publicKey, s]));

    const proposalsWithSovereign = proposals.map(p => ({
      ...p,
      sovereignDetails: sovereignMap.get(p.sovereign),
    }));

    res.json(proposalsWithSovereign);
  } catch (error) {
    console.error('Error fetching active proposals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/proposals/:id - Get proposal by publicKey
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const proposal = await Proposal.findOne({ publicKey: id }).lean();

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const sovereign = await Sovereign.findOne({ publicKey: proposal.sovereign }).lean();

    res.json({
      ...proposal,
      sovereignDetails: sovereign,
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
