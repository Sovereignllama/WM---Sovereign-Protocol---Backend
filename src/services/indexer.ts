import { Sovereign, Deposit, GenesisNFT, Proposal, Event, EventType } from '../models';

// Helius webhook event structure
interface HeliusWebhookEvent {
  accountData?: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: Array<{
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
      userAccount: string;
    }>;
  }>;
  description?: string;
  events?: Record<string, unknown>;
  fee: number;
  feePayer: string;
  instructions: Array<{
    accounts: string[];
    data: string;
    innerInstructions: Array<{
      accounts: string[];
      data: string;
      programId: string;
    }>;
    programId: string;
  }>;
  nativeTransfers?: Array<{
    amount: number;
    fromUserAccount: string;
    toUserAccount: string;
  }>;
  signature: string;
  slot: number;
  source: string;
  timestamp: number;
  tokenTransfers?: Array<{
    fromTokenAccount: string;
    fromUserAccount: string;
    mint: string;
    toTokenAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    tokenStandard: string;
  }>;
  transactionError: string | null;
  type: string;
}

/**
 * Process incoming Helius webhook event
 * This is a placeholder - actual implementation depends on program IDL
 */
export async function processWebhookEvent(event: HeliusWebhookEvent): Promise<void> {
  console.log(`📥 Processing event: ${event.signature} (${event.type})`);
  
  // Skip failed transactions
  if (event.transactionError) {
    console.log(`⏭️ Skipping failed tx: ${event.transactionError}`);
    return;
  }

  // Parse program events based on instruction data
  // This is a simplified example - actual implementation needs to decode
  // Anchor instruction discriminators and event data
  
  const blockTime = new Date(event.timestamp * 1000);
  
  // Example: Detect sovereign creation by analyzing account changes
  // In practice, you'd decode the instruction data using the IDL
  
  // For now, just log the event
  console.log(`✅ Processed event at slot ${event.slot}`);
}

/**
 * Handle SovereignCreated event
 */
export async function handleSovereignCreated(data: {
  publicKey: string;
  sovereignId: number;
  creator: string;
  name: string;
  tokenMint: string;
  sovereignType: 'TokenLaunch' | 'BYOToken';
  bondTarget: string;
  bondDurationDays: number;
  sellFeeBps: number;
  swapFeeBps: number;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  const bondDeadline = new Date(data.blockTime);
  bondDeadline.setDate(bondDeadline.getDate() + data.bondDurationDays);

  await Sovereign.findOneAndUpdate(
    { publicKey: data.publicKey },
    {
      $set: {
        sovereignId: data.sovereignId,
        name: data.name,
        creator: data.creator,
        tokenMint: data.tokenMint,
        sovereignType: data.sovereignType,
        bondTarget: data.bondTarget,
        bondDeadline,
        bondDurationDays: data.bondDurationDays,
        sellFeeBps: data.sellFeeBps,
        swapFeeBps: data.swapFeeBps,
        status: 'Bonding',
      },
    },
    { upsert: true, new: true }
  );

  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'SovereignCreated' as EventType,
    sovereign: data.publicKey,
    data: {
      sovereignId: data.sovereignId,
      name: data.name,
      creator: data.creator,
      bondTarget: data.bondTarget,
    },
  });

  console.log(`✅ Created sovereign: ${data.name} (${data.publicKey})`);
}

/**
 * Handle Deposit event
 */
export async function handleDeposit(data: {
  publicKey: string;
  sovereign: string;
  depositor: string;
  amount: string;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  // Update or create deposit record
  const deposit = await Deposit.findOneAndUpdate(
    { sovereign: data.sovereign, depositor: data.depositor },
    {
      $set: {
        publicKey: data.publicKey,
      },
      $inc: {
        amount: data.amount, // Note: This is simplified, actual bigint handling needed
      },
    },
    { upsert: true, new: true }
  );

  // Update sovereign totals
  await Sovereign.findOneAndUpdate(
    { publicKey: data.sovereign },
    {
      $inc: {
        depositorCount: deposit.isNew ? 1 : 0,
      },
    }
  );

  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'Deposit' as EventType,
    sovereign: data.sovereign,
    depositor: data.depositor,
    data: {
      amount: data.amount,
    },
  });

  console.log(`✅ Deposit: ${data.depositor} -> ${data.sovereign} (${data.amount})`);
}

/**
 * Handle GenesisNFT minted event
 */
export async function handleGenesisNFTMinted(data: {
  mint: string;
  owner: string;
  sovereign: string;
  deposit: string;
  sharesBps: number;
  depositAmount: string;
  name: string;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await GenesisNFT.create({
    mint: data.mint,
    owner: data.owner,
    sovereign: data.sovereign,
    deposit: data.deposit,
    sharesBps: data.sharesBps,
    depositAmount: data.depositAmount,
    name: data.name,
    mintedAt: data.blockTime,
  });

  // Update deposit with NFT mint
  await Deposit.findOneAndUpdate(
    { publicKey: data.deposit },
    { $set: { genesisNftMint: data.mint, sharesBps: data.sharesBps } }
  );

  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'GenesisNFTMinted' as EventType,
    sovereign: data.sovereign,
    depositor: data.owner,
    nftMint: data.mint,
    data: {
      sharesBps: data.sharesBps,
      depositAmount: data.depositAmount,
    },
  });

  console.log(`✅ Genesis NFT minted: ${data.mint} for ${data.owner}`);
}

/**
 * Handle NFT transfer event
 */
export async function handleGenesisNFTTransferred(data: {
  mint: string;
  from: string;
  to: string;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  const nft = await GenesisNFT.findOneAndUpdate(
    { mint: data.mint },
    { $set: { owner: data.to } },
    { new: true }
  );

  if (nft) {
    await Event.create({
      txSignature: data.txSignature,
      slot: data.slot,
      blockTime: data.blockTime,
      eventType: 'GenesisNFTTransferred' as EventType,
      sovereign: nft.sovereign,
      nftMint: data.mint,
      data: {
        from: data.from,
        to: data.to,
      },
    });
  }

  console.log(`✅ Genesis NFT transferred: ${data.mint} from ${data.from} to ${data.to}`);
}

/**
 * Handle sovereign status change
 */
export async function handleSovereignStatusChange(data: {
  sovereign: string;
  newStatus: 'Recovery' | 'Active' | 'Failed' | 'Unwound';
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  const updateData: Record<string, unknown> = {
    status: data.newStatus,
  };

  if (data.newStatus === 'Recovery' || data.newStatus === 'Active') {
    updateData.finalizedAt = data.blockTime;
  }

  if (data.newStatus === 'Unwound') {
    updateData.unwoundAt = data.blockTime;
  }

  await Sovereign.findOneAndUpdate(
    { publicKey: data.sovereign },
    { $set: updateData }
  );

  const eventType = data.newStatus === 'Failed' 
    ? 'SovereignFailed' 
    : data.newStatus === 'Unwound'
    ? 'SovereignUnwound'
    : 'SovereignFinalized';

  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: eventType as EventType,
    sovereign: data.sovereign,
    data: {
      newStatus: data.newStatus,
    },
  });

  console.log(`✅ Sovereign ${data.sovereign} status changed to ${data.newStatus}`);
}
