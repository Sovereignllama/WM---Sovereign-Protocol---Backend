import { Sovereign, Deposit, GenesisNFT, Proposal, Event, EventType } from '../models';
import { config } from '../config';
import { PublicKey } from '@solana/web3.js';

// V3 Engine Program ID
const ENGINE_V3_PROGRAM_ID = new PublicKey('Sov7HzpTsU3GttXmHBzjRhrjrCQ5RPYhkMns6zNUNtt');

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

    // Derive deterministic engine pool PDA (V3 engine) and store it
    if (config.programId) {
      const sovereignPubkey = new PublicKey(data.sovereign);
      const [enginePool] = PublicKey.findProgramAddressSync(
        [Buffer.from('engine_pool'), sovereignPubkey.toBuffer()],
        ENGINE_V3_PROGRAM_ID
      );
      updateData.enginePool = enginePool.toBase58();
    }
  }

  if (data.newStatus === 'Unwound') {
    updateData.unwoundAt = data.blockTime;
  }

  await Sovereign.findOneAndUpdate(
    { publicKey: data.sovereign },
    { $set: updateData }
  );

  // Auto-register pool with pool-price-worker for volume tracking
  if (data.newStatus === 'Recovery' || data.newStatus === 'Active') {
    await registerPoolWithPriceWorker(data.sovereign);
  }

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

/**
 * Register a sovereign's pool with the pool-price-worker for volume/price tracking.
 * Called automatically when a sovereign transitions to Recovery or Active.
 */
async function registerPoolWithPriceWorker(sovereignPubkey: string): Promise<void> {
  try {
    const sovereign = await Sovereign.findOne({ publicKey: sovereignPubkey });
    if (!sovereign) {
      console.warn(`⚠️ Pool registration skipped: sovereign ${sovereignPubkey} not found`);
      return;
    }

    const poolAddress = sovereign.enginePool || sovereign.lbPair || sovereign.whirlpool;
    if (!poolAddress) {
      console.warn(`⚠️ Pool registration skipped: sovereign ${sovereignPubkey} has no pool address`);
      return;
    }

    const body = {
      poolAddress,
      tokenMint: sovereign.tokenMint,
      tokenSymbol: sovereign.tokenSymbol || `SOV${sovereign.sovereignId}`,
      tokenName: sovereign.tokenName || sovereign.name,
      tokenDecimals: sovereign.tokenDecimals || 9,
    };

    const response = await fetch(`${config.poolPriceWorkerUrl}/api/pools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Pool registered with price worker: ${poolAddress} (${sovereign.tokenSymbol || sovereign.name}) — ${response.status === 201 ? 'created' : 'already exists'}`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Pool registration failed (${response.status}): ${errorText}`);
    }
  } catch (error: any) {
    // Non-fatal — don't block status transition if price worker is down
    console.error(`❌ Pool registration error (non-fatal): ${error.message}`);
  }
}

// ============================================================
// V3 Engine Event Handlers
// ============================================================

/**
 * Handle V3 Engine Swap event (buy or sell)
 */
export async function handleEngineSwap(data: {
  pool: string;
  trader: string;
  isBuy: boolean;
  gorAmount: string;
  tokenAmount: string;
  fee: string;
  executionPrice: string;
  gorReserve: string;
  tokenReserve: string;
  activeBin: number;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'EngineSwap' as EventType,
    sovereign: data.pool,
    depositor: data.trader,
    data: {
      isBuy: data.isBuy,
      gorAmount: data.gorAmount,
      tokenAmount: data.tokenAmount,
      fee: data.fee,
      executionPrice: data.executionPrice,
      gorReserve: data.gorReserve,
      tokenReserve: data.tokenReserve,
      activeBin: data.activeBin,
    },
  });

  console.log(`✅ Engine swap: ${data.isBuy ? 'BUY' : 'SELL'} ${data.gorAmount} GOR ↔ ${data.tokenAmount} tokens`);
}

/**
 * Handle V3 BinFilled event — a bin became fully purchased
 */
export async function handleBinFilled(data: {
  pool: string;
  binIndex: number;
  gorLocked: string;
  binCapacity: string;
  lockedRate: string;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'BinFilled' as EventType,
    sovereign: data.pool,
    data: {
      binIndex: data.binIndex,
      gorLocked: data.gorLocked,
      binCapacity: data.binCapacity,
      lockedRate: data.lockedRate,
    },
  });

  console.log(`✅ Bin filled: pool ${data.pool.slice(0,8)}… bin #${data.binIndex}, ${data.gorLocked} GOR locked`);
}

/**
 * Handle V3 BinEmptied event — a bin returned to empty (all tokens returned via sells)
 */
export async function handleBinEmptied(data: {
  pool: string;
  binIndex: number;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'BinEmptied' as EventType,
    sovereign: data.pool,
    data: {
      binIndex: data.binIndex,
    },
  });

  console.log(`✅ Bin emptied: pool ${data.pool.slice(0,8)}… bin #${data.binIndex}`);
}

/**
 * Handle V3 BinPageAllocated event — a new BinArray page was allocated
 */
export async function handleBinPageAllocated(data: {
  pool: string;
  pageIndex: number;
  binsOnPage: number;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'BinPageAllocated' as EventType,
    sovereign: data.pool,
    data: {
      pageIndex: data.pageIndex,
      binsOnPage: data.binsOnPage,
    },
  });

  console.log(`✅ Bin page allocated: pool ${data.pool.slice(0,8)}… page #${data.pageIndex} (${data.binsOnPage} bins)`);
}

/**
 * Handle V3 BinFeeSettled event — a bin's fee credit was settled during a sell
 */
export async function handleBinFeeSettled(data: {
  pool: string;
  binIndex: number;
  creditDelta: string;
  totalCredit: string;
  accumulator: string;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'BinFeeSettled' as EventType,
    sovereign: data.pool,
    data: {
      binIndex: data.binIndex,
      creditDelta: data.creditDelta,
      totalCredit: data.totalCredit,
      accumulator: data.accumulator,
    },
  });

  console.log(`✅ Bin fee settled: pool ${data.pool.slice(0,8)}… bin #${data.binIndex}, +${data.creditDelta} credit`);
}

/**
 * Handle V3 PoolCreated event
 */
export async function handleEnginePoolCreated(data: {
  sovereign: string;
  pool: string;
  initialGorReserve: string;
  totalTokenSupply: string;
  numBins: number;
  binCapacity: string;
  swapFeeBps: number;
  creatorFeeShareBps: number;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'PoolCreated' as EventType,
    sovereign: data.sovereign,
    data: {
      pool: data.pool,
      initialGorReserve: data.initialGorReserve,
      totalTokenSupply: data.totalTokenSupply,
      numBins: data.numBins,
      binCapacity: data.binCapacity,
      swapFeeBps: data.swapFeeBps,
      creatorFeeShareBps: data.creatorFeeShareBps,
    },
  });

  // Update sovereign with V3 engine pool address
  await Sovereign.findOneAndUpdate(
    { publicKey: data.sovereign },
    { $set: { enginePool: data.pool } }
  );

  console.log(`✅ Engine pool created: ${data.pool} for sovereign ${data.sovereign.slice(0,8)}…`);
}

/**
 * Handle V3 RecoveryComplete event
 */
export async function handleRecoveryComplete(data: {
  pool: string;
  totalRecovered: string;
  recoveryTarget: string;
  tradeCount: string;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'RecoveryComplete' as EventType,
    sovereign: data.pool,
    data: {
      totalRecovered: data.totalRecovered,
      recoveryTarget: data.recoveryTarget,
      tradeCount: data.tradeCount,
    },
  });

  console.log(`✅ Recovery complete: pool ${data.pool.slice(0,8)}… recovered ${data.totalRecovered}/${data.recoveryTarget}`);
}

/**
 * Handle V3 LpFeeClaimed event
 */
export async function handleLpFeeClaimed(data: {
  pool: string;
  depositor: string;
  recipient: string;
  amount: string;
  depositAmount: string;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'LpFeeClaimed' as EventType,
    sovereign: data.pool,
    depositor: data.depositor,
    data: {
      recipient: data.recipient,
      amount: data.amount,
      depositAmount: data.depositAmount,
    },
  });

  console.log(`✅ LP fees claimed: ${data.amount} GOR by ${data.depositor.slice(0,8)}…`);
}

/**
 * Handle V3 CreatorFeeClaimed event
 */
export async function handleCreatorFeeClaimed(data: {
  pool: string;
  recipient: string;
  amount: string;
  totalClaimed: string;
  txSignature: string;
  slot: number;
  blockTime: Date;
}): Promise<void> {
  await Event.create({
    txSignature: data.txSignature,
    slot: data.slot,
    blockTime: data.blockTime,
    eventType: 'CreatorFeeClaimed' as EventType,
    sovereign: data.pool,
    data: {
      recipient: data.recipient,
      amount: data.amount,
      totalClaimed: data.totalClaimed,
    },
  });

  console.log(`✅ Creator fees claimed: ${data.amount} GOR, total: ${data.totalClaimed}`);
}
