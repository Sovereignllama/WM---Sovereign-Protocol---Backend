import { Router, Request, Response } from 'express';
import { Sovereign, SovereignStatus } from '../models';

const router = Router();

// GET /api/sovereigns - List all sovereigns with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      creator, 
      activityCheck,
      page = '1', 
      limit = '20',
      sort = '-createdAt'
    } = req.query;

    const query: Record<string, unknown> = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (creator) {
      query.creator = creator;
    }
    
    if (activityCheck === 'true') {
      query.activityCheckInitiated = true;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [sovereigns, total] = await Promise.all([
      Sovereign.find(query)
        .sort(sort as string)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Sovereign.countDocuments(query),
    ]);

    res.json({
      data: sovereigns,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching sovereigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sovereigns/stats - Protocol statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      totalCount,
      statusCounts,
      totalRaised,
      totalFees,
    ] = await Promise.all([
      Sovereign.countDocuments(),
      Sovereign.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Sovereign.aggregate([
        { $match: { status: { $in: ['Recovery', 'Active'] } } },
        { $group: { _id: null, total: { $sum: { $toLong: '$totalDeposited' } } } }
      ]),
      Sovereign.aggregate([
        { $group: { _id: null, total: { $sum: { $toLong: '$totalGorFeesDistributed' } } } }
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: { _id: string; count: number }) => {
      statusMap[s._id] = s.count;
    });

    res.json({
      totalSovereigns: totalCount,
      byStatus: {
        bonding: statusMap['Bonding'] || 0,
        recovery: statusMap['Recovery'] || 0,
        active: statusMap['Active'] || 0,
        failed: statusMap['Failed'] || 0,
        unwound: statusMap['Unwound'] || 0,
      },
      totalRaisedLamports: totalRaised[0]?.total?.toString() || '0',
      totalFeesDistributedLamports: totalFees[0]?.total?.toString() || '0',
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sovereigns/:id - Get single sovereign by publicKey or sovereignId
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Try to find by publicKey first, then by sovereignId
    let sovereign = await Sovereign.findOne({ publicKey: id }).lean();
    
    if (!sovereign && !isNaN(Number(id))) {
      sovereign = await Sovereign.findOne({ sovereignId: Number(id) }).lean();
    }

    if (!sovereign) {
      return res.status(404).json({ error: 'Sovereign not found' });
    }

    res.json(sovereign);
  } catch (error) {
    console.error('Error fetching sovereign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
