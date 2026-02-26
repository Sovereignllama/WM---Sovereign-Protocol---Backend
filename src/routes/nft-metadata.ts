import { Router, Request, Response } from 'express';
import { GenesisNFT, Sovereign } from '../models';
import { config } from '../config';

const FALLBACK_IMAGE = 'https://gateway.pinata.cloud/ipfs/QmPlaceholder';

const router = Router();

/**
 * GET /api/nft-metadata/collection
 * Returns Metaplex-compatible metadata JSON for the Sovereign Genesis Collection NFT.
 * This endpoint is referenced on-chain in the collection NFT's URI field.
 */
router.get('/collection', async (_req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.json({
      name: 'Sovereign Genesis Collection',
      symbol: 'GNFT',
      description:
        'The official collection of Sovereign Genesis NFTs — on-chain deposit receipts representing bonding positions in the Sovereign Liquidity Protocol.',
      image: config.collectionImageUrl || FALLBACK_IMAGE,
      external_url: 'https://sovereignprotocol.com',
      properties: {
        files: [],
        category: 'image',
      },
    });
  } catch (error) {
    console.error('Error serving collection metadata:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/nft-metadata/:sovereign/:number
 * Returns Metaplex-compatible metadata JSON for an individual Genesis NFT.
 * This endpoint is referenced on-chain in each Genesis NFT's URI field.
 *
 * The metadata is assembled dynamically from the backend DB (which syncs from on-chain).
 * For beta this is served centrally; for mainnet these will be migrated to Arweave/IPFS.
 */
router.get('/:sovereign/:number', async (req: Request, res: Response) => {
  try {
    const { sovereign: sovereignPubkey, number: nftNumber } = req.params;

    // Look up the NFT in the DB
    const nft = await GenesisNFT.findOne({
      sovereign: sovereignPubkey,
      name: { $regex: new RegExp(`#\\d+-${nftNumber}$`) },
    }).lean();

    // Look up the sovereign for richer metadata
    const sovereign = await Sovereign.findOne({
      publicKey: sovereignPubkey,
    }).lean();

    if (!nft && !sovereign) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    const sovereignName = sovereign?.name || 'Unknown Sovereign';
    const tokenSymbol = sovereign?.tokenSymbol || '???';
    const positionBps = nft?.sharesBps ?? 0;
    const depositAmount = nft?.depositAmount ?? '0';
    const name = nft?.name || `$overeign#?-${nftNumber}`;

    // Build Metaplex-compatible metadata
    const metadata: Record<string, unknown> = {
      name,
      symbol: 'GNFT',
      description: `Genesis NFT #${nftNumber} for ${sovereignName} ($${tokenSymbol}). This deposit receipt represents a ${(positionBps / 100).toFixed(2)}% position in the sovereign bonding pool.`,
      image: sovereign?.metadataUri
        ? undefined // Will be resolved below
        : (config.defaultNftImageUrl || FALLBACK_IMAGE),
      external_url: `https://sovereignprotocol.com/sovereign/${sovereignPubkey}`,
      attributes: [
        { trait_type: 'Sovereign', value: sovereignName },
        { trait_type: 'Token', value: tokenSymbol },
        { trait_type: 'Position BPS', value: positionBps, display_type: 'number' },
        { trait_type: 'Deposit Amount', value: depositAmount },
        { trait_type: 'NFT Number', value: parseInt(nftNumber, 10), display_type: 'number' },
        { trait_type: 'Status', value: sovereign?.status || 'Unknown' },
      ],
      properties: {
        files: [],
        category: 'image',
      },
    };

    // Try to resolve the sovereign's token image for the NFT image
    if (sovereign?.metadataUri) {
      try {
        const tokenMetaRes = await fetch(sovereign.metadataUri);
        if (tokenMetaRes.ok) {
          const tokenMeta = (await tokenMetaRes.json()) as { image?: string };
          if (tokenMeta.image) {
            metadata.image = tokenMeta.image;
            metadata.properties = {
              files: [{ uri: tokenMeta.image, type: 'image' }],
              category: 'image',
            };
          }
        }
      } catch {
        // Fall back to placeholder if token metadata fetch fails
      }
    }

    // Ensure image is set
    if (!metadata.image) {
      metadata.image = config.defaultNftImageUrl || FALLBACK_IMAGE;
    }

    res.set('Cache-Control', 'public, max-age=3600'); // Cache 1h
    return res.json(metadata);
  } catch (error) {
    console.error('Error serving NFT metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
