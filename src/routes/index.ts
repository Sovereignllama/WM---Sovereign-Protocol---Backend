import { Router } from 'express';
import sovereignsRouter from './sovereigns';
import depositsRouter from './deposits';
import nftsRouter from './nfts';
import proposalsRouter from './proposals';
import eventsRouter from './events';
import uploadRouter from './upload';
import sovereignPagesRouter from './sovereign-pages';

const router = Router();

router.use('/sovereigns', sovereignsRouter);
router.use('/deposits', depositsRouter);
router.use('/nfts', nftsRouter);
router.use('/proposals', proposalsRouter);
router.use('/events', eventsRouter);
router.use('/upload', uploadRouter);
router.use('/sovereign-pages', sovereignPagesRouter);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
