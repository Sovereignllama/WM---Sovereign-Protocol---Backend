import { Router, Request, Response } from 'express';
import { Event } from '../models';

const router = Router();

// GET /api/events - List events with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      sovereign, 
      depositor,
      eventType,
      page = '1', 
      limit = '50',
    } = req.query;

    const query: Record<string, unknown> = {};
    
    if (sovereign) {
      query.sovereign = sovereign;
    }
    
    if (depositor) {
      query.depositor = depositor;
    }
    
    if (eventType) {
      query.eventType = eventType;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      Event.find(query)
        .sort('-blockTime')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Event.countDocuments(query),
    ]);

    res.json({
      data: events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/recent - Get recent events across all sovereigns
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 100);

    const events = await Event.find()
      .sort('-blockTime')
      .limit(limitNum)
      .lean();

    res.json(events);
  } catch (error) {
    console.error('Error fetching recent events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/sovereign/:sovereign - Get events for a sovereign
router.get('/sovereign/:sovereign', async (req: Request, res: Response) => {
  try {
    const { sovereign } = req.params;
    const { limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 200);

    const events = await Event.find({ sovereign })
      .sort('-blockTime')
      .limit(limitNum)
      .lean();

    res.json(events);
  } catch (error) {
    console.error('Error fetching sovereign events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
