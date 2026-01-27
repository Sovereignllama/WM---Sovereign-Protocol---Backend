import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { processWebhookEvent } from '../services/indexer';

const router = Router();

// Verify Helius webhook signature
function verifyHeliusSignature(payload: string, signature: string): boolean {
  if (!config.heliusWebhookSecret) {
    console.warn('⚠️ HELIUS_WEBHOOK_SECRET not set, skipping signature verification');
    return true;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', config.heliusWebhookSecret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// POST /webhook/helius - Receive Helius webhook events
router.post('/helius', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-helius-signature'] as string;
    const payload = JSON.stringify(req.body);
    
    // Verify signature in production
    if (config.nodeEnv === 'production' && !verifyHeliusSignature(payload, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process events asynchronously
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    // Acknowledge receipt immediately
    res.status(200).json({ received: events.length });
    
    // Process in background
    for (const event of events) {
      try {
        await processWebhookEvent(event);
      } catch (error) {
        console.error('Error processing event:', error);
      }
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
