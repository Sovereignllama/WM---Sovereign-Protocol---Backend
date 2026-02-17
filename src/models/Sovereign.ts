import mongoose, { Document, Schema } from 'mongoose';

// Sovereign Status enum matching on-chain
export type SovereignStatus = 'Bonding' | 'Recovery' | 'Active' | 'Failed' | 'Unwound';
export type SovereignType = 'TokenLaunch' | 'BYOToken';

export interface ISovereign extends Document {
  // Identity
  publicKey: string;           // PDA address
  sovereignId: number;
  name: string;
  
  // Creator
  creator: string;
  
  // Token info
  tokenMint: string;
  sovereignType: SovereignType;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals: number;
  tokenSupplyDeposited: string;  // bigint as string
  tokenTotalSupply: string;
  
  // Bond configuration
  bondTarget: string;            // lamports as string
  bondDeadline: Date;
  bondDurationDays: number;
  
  // Current state
  status: SovereignStatus;
  totalDeposited: string;        // investor GOR deposited
  depositorCount: number;
  
  // Fee configuration
  sellFeeBps: number;
  swapFeeBps: number;
  creationFeeEscrowed: string;
  
  // Creator escrow
  creatorEscrow: string;
  creatorMaxBuyBps: number;
  
  // Recovery tracking
  totalGorFeesCollected: string;
  totalGorFeesDistributed: string;
  totalTokenFeesCollected: string;
  recoveryTarget: string;
  recoveryComplete: boolean;
  
  // Engine pool
  enginePool?: string;

  // LP info (deprecated — DLMM/SAMM era)
  whirlpool?: string;     // deprecated
  positionMint?: string;  // deprecated
  lbPair?: string;        // deprecated
  position?: string;      // deprecated
  permanentLock?: string; // deprecated
  
  // Unwind state
  unwindGorBalance: string;
  unwindTokenBalance: string;
  
  // Activity check
  activityCheckInitiated: boolean;
  activityCheckTimestamp?: Date;
  autoUnwindPeriod: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  finalizedAt?: Date;
  unwoundAt?: Date;
}

const SovereignSchema = new Schema<ISovereign>({
  publicKey: { type: String, required: true, unique: true, index: true },
  sovereignId: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true },
  
  creator: { type: String, required: true, index: true },
  
  tokenMint: { type: String, required: true },
  sovereignType: { type: String, enum: ['TokenLaunch', 'BYOToken'], required: true },
  tokenSymbol: String,
  tokenName: String,
  tokenDecimals: { type: Number, default: 9 },
  tokenSupplyDeposited: { type: String, default: '0' },
  tokenTotalSupply: { type: String, default: '0' },
  
  bondTarget: { type: String, required: true },
  bondDeadline: { type: Date, required: true },
  bondDurationDays: { type: Number, required: true },
  
  status: { 
    type: String, 
    enum: ['Bonding', 'Recovery', 'Active', 'Failed', 'Unwound'], 
    default: 'Bonding',
    index: true 
  },
  totalDeposited: { type: String, default: '0' },
  depositorCount: { type: Number, default: 0 },
  
  sellFeeBps: { type: Number, default: 0 },
  swapFeeBps: { type: Number, default: 30 },
  creationFeeEscrowed: { type: String, default: '0' },
  
  creatorEscrow: { type: String, default: '0' },
  creatorMaxBuyBps: { type: Number, default: 100 },
  
  totalGorFeesCollected: { type: String, default: '0' },
  totalGorFeesDistributed: { type: String, default: '0' },
  totalTokenFeesCollected: { type: String, default: '0' },
  recoveryTarget: { type: String, default: '0' },
  recoveryComplete: { type: Boolean, default: false },
  
  enginePool: String,

  // Deprecated DLMM/SAMM fields — kept for historical data
  whirlpool: String,
  positionMint: String,
  lbPair: String,
  position: String,
  permanentLock: String,
  
  unwindGorBalance: { type: String, default: '0' },
  unwindTokenBalance: { type: String, default: '0' },
  
  activityCheckInitiated: { type: Boolean, default: false },
  activityCheckTimestamp: Date,
  autoUnwindPeriod: { type: Number, default: 90 * 24 * 60 * 60 },
  
  finalizedAt: Date,
  unwoundAt: Date,
}, {
  timestamps: true,
});

// Indexes for common queries
SovereignSchema.index({ status: 1, createdAt: -1 });
SovereignSchema.index({ creator: 1, status: 1 });
SovereignSchema.index({ activityCheckInitiated: 1, status: 1 });

export const Sovereign = mongoose.model<ISovereign>('Sovereign', SovereignSchema);
