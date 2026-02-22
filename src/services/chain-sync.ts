import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config';
import { Sovereign } from '../models/Sovereign';

// ============================================================
// SovereignState Deserialization — matches on-chain state.rs
// ============================================================

const PROGRAM_ID = new PublicKey(config.programId);
const DISCRIMINATOR = Buffer.from([42, 162, 40, 206, 227, 8, 23, 212]);
const DISCRIMINATOR_SIZE = 8;

const STATUS_LABELS = [
  'Bonding', 'Finalizing', 'PoolCreated', 'Recovery', 'Active',
  'Unwinding', 'Unwound', 'Failed', 'Halted', 'Retired',
] as const;

const TYPE_LABELS = ['TokenLaunch', 'BYOToken'] as const;
const FEE_MODE_LABELS = ['CreatorRevenue', 'RecoveryBoost', 'FairLaunch'] as const;

// ── Buffer helpers ──────────────────────────────────────────

function readU8(buf: Buffer, o: number): number { return buf.readUInt8(o); }
function readU16LE(buf: Buffer, o: number): number { return buf.readUInt16LE(o); }
function readU32LE(buf: Buffer, o: number): number { return buf.readUInt32LE(o); }
function readU64LE(buf: Buffer, o: number): bigint { return buf.readBigUInt64LE(o); }
function readI64LE(buf: Buffer, o: number): bigint { return buf.readBigInt64LE(o); }
function readBool(buf: Buffer, o: number): boolean { return buf.readUInt8(o) !== 0; }
function readPubkey(buf: Buffer, o: number): PublicKey { return new PublicKey(buf.subarray(o, o + 32)); }

/**
 * Read a Borsh string: 4-byte little-endian length prefix + UTF-8 bytes.
 * Returns [stringValue, totalBytesConsumed].
 */
function readString(buf: Buffer, o: number): [string, number] {
  const len = buf.readUInt32LE(o);
  const str = buf.subarray(o + 4, o + 4 + len).toString('utf8').replace(/\0+$/, '');
  return [str, 4 + len];
}

/**
 * Read Option<i64>: 1-byte tag (0=None, 1=Some) + 8 bytes if Some.
 * Returns [value | null, bytesConsumed].
 */
function readOptionI64(buf: Buffer, o: number): [bigint | null, number] {
  const tag = buf.readUInt8(o);
  if (tag === 0) return [null, 1];
  return [buf.readBigInt64LE(o + 1), 9];
}

// ── Deserialized account type ───────────────────────────────

interface ParsedSovereignState {
  sovereignId: bigint;
  creator: PublicKey;
  tokenMint: PublicKey;
  sovereignType: number;
  state: number;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  metadataUri: string;
  bondTarget: bigint;
  bondDeadline: bigint;
  bondDuration: bigint;
  totalDeposited: bigint;
  depositorCount: number;
  creatorEscrow: bigint;
  tokenSupplyDeposited: bigint;
  tokenTotalSupply: bigint;
  sellFeeBps: number;
  feeMode: number;
  feeControlRenounced: boolean;
  creationFeeEscrowed: bigint;
  swapFeeBps: number;
  recoveryTarget: bigint;
  totalSolFeesDistributed: bigint;
  recoveryComplete: boolean;
  activeProposalId: bigint;
  proposalCount: bigint;
  hasActiveProposal: boolean;
  totalFeesCollected: bigint;
  totalRecovered: bigint;
  genesisNftMint: PublicKey;
  unwoundAt: bigint | null;
  lastActivity: bigint;
  activityCheckInitiated: boolean;
  activityCheckInitiatedAt: bigint | null;
  activityCheckTimestamp: bigint;
  unwindSolBalance: bigint;
  unwindTokenBalance: bigint;
  lastActivityTimestamp: bigint;
  createdAt: bigint;
  finalizedAt: bigint;
  bump: number;
}

function deserializeSovereignState(data: Buffer): ParsedSovereignState {
  let o = DISCRIMINATOR_SIZE;

  const sovereignId = readU64LE(data, o); o += 8;
  const creator = readPubkey(data, o); o += 32;
  const tokenMint = readPubkey(data, o); o += 32;
  const sovereignType = readU8(data, o); o += 1;
  const state = readU8(data, o); o += 1;

  const [name, nameBytes] = readString(data, o); o += nameBytes;
  const [tokenName, tnBytes] = readString(data, o); o += tnBytes;
  const [tokenSymbol, tsBytes] = readString(data, o); o += tsBytes;
  const [metadataUri, muBytes] = readString(data, o); o += muBytes;

  const bondTarget = readU64LE(data, o); o += 8;
  const bondDeadline = readI64LE(data, o); o += 8;
  const bondDuration = readI64LE(data, o); o += 8;

  const totalDeposited = readU64LE(data, o); o += 8;
  const depositorCount = readU32LE(data, o); o += 4;
  const creatorEscrow = readU64LE(data, o); o += 8;

  const tokenSupplyDeposited = readU64LE(data, o); o += 8;
  const tokenTotalSupply = readU64LE(data, o); o += 8;

  const sellFeeBps = readU16LE(data, o); o += 2;
  const feeMode = readU8(data, o); o += 1;
  const feeControlRenounced = readBool(data, o); o += 1;
  const creationFeeEscrowed = readU64LE(data, o); o += 8;

  // _pad_amm_config (32 bytes)
  o += 32;

  const swapFeeBps = readU16LE(data, o); o += 2;

  // Legacy padding: preset(32) + bin_step(2) + active_id(4) + lower_bin(4) + upper_bin(4)
  //   + position_base(32) + pool_state(32) + lb_pair(32) + position_mint(32) + position(32)
  //   + pool_restricted(1)
  o += 32 + 2 + 4 + 4 + 4 + 32 + 32 + 32 + 32 + 32 + 1;

  const recoveryTarget = readU64LE(data, o); o += 8;
  const totalSolFeesDistributed = readU64LE(data, o); o += 8;

  // _pad_token_fees (8 bytes)
  o += 8;

  const recoveryComplete = readBool(data, o); o += 1;

  const activeProposalId = readU64LE(data, o); o += 8;
  const proposalCount = readU64LE(data, o); o += 8;
  const hasActiveProposal = readBool(data, o); o += 1;

  // _pad_fee_threshold (2 bytes)
  o += 2;

  const totalFeesCollected = readU64LE(data, o); o += 8;
  const totalRecovered = readU64LE(data, o); o += 8;

  // _pad_total_supply (8 bytes)
  o += 8;

  const genesisNftMint = readPubkey(data, o); o += 32;

  const [unwoundAt, uBytes] = readOptionI64(data, o); o += uBytes;
  const lastActivity = readI64LE(data, o); o += 8;

  const activityCheckInitiated = readBool(data, o); o += 1;
  const [activityCheckInitiatedAt, aciBytes] = readOptionI64(data, o); o += aciBytes;
  const activityCheckTimestamp = readI64LE(data, o); o += 8;

  // fee_growth_snapshot_a (16) + fee_growth_snapshot_b (16) + activity_check_last_cancelled (8)
  o += 16 + 16 + 8;

  const unwindSolBalance = readU64LE(data, o); o += 8;
  const unwindTokenBalance = readU64LE(data, o); o += 8;

  // token_redemption_pool(8) + circulating_tokens_at_unwind(8) + token_redemption_deadline(8)
  o += 8 + 8 + 8;

  const lastActivityTimestamp = readI64LE(data, o); o += 8;
  const createdAt = readI64LE(data, o); o += 8;
  const finalizedAt = readI64LE(data, o); o += 8;
  const bump = readU8(data, o); o += 1;

  return {
    sovereignId, creator, tokenMint, sovereignType, state,
    name, tokenName, tokenSymbol, metadataUri,
    bondTarget, bondDeadline, bondDuration,
    totalDeposited, depositorCount, creatorEscrow,
    tokenSupplyDeposited, tokenTotalSupply,
    sellFeeBps, feeMode, feeControlRenounced, creationFeeEscrowed,
    swapFeeBps,
    recoveryTarget, totalSolFeesDistributed, recoveryComplete,
    activeProposalId, proposalCount, hasActiveProposal,
    totalFeesCollected, totalRecovered,
    genesisNftMint, unwoundAt, lastActivity,
    activityCheckInitiated, activityCheckInitiatedAt,
    activityCheckTimestamp, unwindSolBalance, unwindTokenBalance,
    lastActivityTimestamp, createdAt, finalizedAt, bump,
  };
}

// ── PDA derivation ──────────────────────────────────────────

function getSovereignPDA(sovereignId: bigint): PublicKey {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(sovereignId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('sovereign'), idBuf],
    PROGRAM_ID,
  );
  return pda;
}

// ── Timestamp helper ────────────────────────────────────────

function tsToDate(ts: bigint): Date | undefined {
  const n = Number(ts);
  return n > 0 ? new Date(n * 1000) : undefined;
}

// ── Status label ────────────────────────────────────────────

function statusLabel(idx: number): string {
  return STATUS_LABELS[idx] ?? 'Unknown';
}

function typeLabel(idx: number): string {
  return TYPE_LABELS[idx] ?? 'TokenLaunch';
}

// ── Upsert one sovereign ────────────────────────────────────

function upsertSovereign(pda: PublicKey, parsed: ParsedSovereignState) {
  const bondDurationSeconds = Number(parsed.bondDuration);
  const bondDurationDays = Math.max(1, Math.round(bondDurationSeconds / 86400));

  return Sovereign.findOneAndUpdate(
    { publicKey: pda.toBase58() },
    {
      $set: {
        sovereignId: Number(parsed.sovereignId),
        name: parsed.name || `Sovereign #${parsed.sovereignId}`,
        creator: parsed.creator.toBase58(),
        tokenMint: parsed.tokenMint.toBase58(),
        sovereignType: typeLabel(parsed.sovereignType) as 'TokenLaunch' | 'BYOToken',
        tokenSymbol: parsed.tokenSymbol || undefined,
        tokenName: parsed.tokenName || undefined,
        tokenDecimals: 9,
        tokenSupplyDeposited: parsed.tokenSupplyDeposited.toString(),
        tokenTotalSupply: parsed.tokenTotalSupply.toString(),
        bondTarget: parsed.bondTarget.toString(),
        bondDeadline: tsToDate(parsed.bondDeadline) || new Date(),
        bondDurationDays,
        status: statusLabel(parsed.state),
        totalDeposited: parsed.totalDeposited.toString(),
        depositorCount: parsed.depositorCount,
        sellFeeBps: parsed.sellFeeBps,
        swapFeeBps: parsed.swapFeeBps,
        creationFeeEscrowed: parsed.creationFeeEscrowed.toString(),
        creatorEscrow: parsed.creatorEscrow.toString(),
        feeControlRenounced: parsed.feeControlRenounced,
        metadataUri: parsed.metadataUri || undefined,
        totalGorFeesCollected: parsed.totalFeesCollected.toString(),
        totalGorFeesDistributed: parsed.totalSolFeesDistributed.toString(),
        recoveryTarget: parsed.recoveryTarget.toString(),
        totalRecovered: parsed.totalRecovered.toString(),
        recoveryComplete: parsed.recoveryComplete,
        unwindGorBalance: parsed.unwindSolBalance.toString(),
        unwindTokenBalance: parsed.unwindTokenBalance.toString(),
        activityCheckInitiated: parsed.activityCheckInitiated,
        activityCheckTimestamp: tsToDate(parsed.activityCheckTimestamp),
        finalizedAt: tsToDate(parsed.finalizedAt),
        unwoundAt: parsed.unwoundAt != null ? tsToDate(parsed.unwoundAt) : undefined,
      },
    },
    { upsert: true, new: true },
  );
}

// ============================================================
// Retry helper
// ============================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5_000; // 5s, 10s, 20s

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(connection: Connection): ReturnType<Connection['getProgramAccounts']> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { memcmp: { offset: 0, bytes: DISCRIMINATOR.toString('base64'), encoding: 'base64' } },
        ],
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      const isRetryable = msg.includes('503') || msg.includes('502') || msg.includes('429') || msg.includes('timeout') || msg.includes('ECONNRESET');
      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[ChainSync] Attempt ${attempt}/${MAX_RETRIES} failed (${msg.substring(0, 80)}), retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw new Error('Unreachable');
}

// ============================================================
// Main sync function
// ============================================================

/**
 * Fetch all SovereignState accounts from chain via getProgramAccounts
 * and upsert them into MongoDB.
 */
async function syncOnce(connection: Connection): Promise<number> {
  try {
    console.log('[ChainSync] Fetching all SovereignState accounts...');

    const accounts = await fetchWithRetry(connection);

    console.log(`[ChainSync] Found ${accounts.length} sovereign account(s) on-chain`);

    let upserted = 0;
    for (const { pubkey, account } of accounts) {
      try {
        const parsed = deserializeSovereignState(Buffer.from(account.data));
        await upsertSovereign(pubkey, parsed);
        upserted++;
      } catch (err) {
        console.error(`[ChainSync] Failed to parse account ${pubkey.toBase58()}:`, err);
      }
    }

    if (upserted > 0) {
      console.log(`[ChainSync] Upserted ${upserted} sovereign(s) into MongoDB`);
    }

    return upserted;
  } catch (err) {
    console.error('[ChainSync] Sync cycle failed:', err);
    return 0;
  }
}

// ============================================================
// Polling loop
// ============================================================

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the chain sync service.
 * Immediately runs one sync, then repeats on interval.
 * @param intervalMs  Re-sync interval (default 60s)
 */
export function startChainSync(intervalMs = 60_000): void {
  if (pollTimer) {
    console.warn('[ChainSync] Already running — skipping duplicate start');
    return;
  }

  if (!config.programId) {
    console.error('[ChainSync] PROGRAM_ID not set in env — cannot sync');
    return;
  }

  const connection = new Connection(config.rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60_000,
  });
  console.log(`[ChainSync] Starting — syncing every ${intervalMs / 1000}s from ${config.rpcUrl}`);

  // Delay first sync by 10s to let the RPC warm up after deploy
  setTimeout(() => {
    syncOnce(connection);
    pollTimer = setInterval(() => syncOnce(connection), intervalMs);
  }, 10_000);
}

/**
 * Stop the chain sync service.
 */
export function stopChainSync(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[ChainSync] Stopped');
  }
}
