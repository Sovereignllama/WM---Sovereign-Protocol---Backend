import mongoose, { Document, Schema } from 'mongoose';

export interface IDeposit extends Document {
  // Identity
  publicKey: string;           // PDA address
  
  // References
  sovereign: string;           // Sovereign publicKey
  depositor: string;           // Depositor wallet
  
  // Deposit info
  amount: string;              // lamports as string
  sharesBps: number;           // basis points (e.g., 1000 = 10%)
  
  // Genesis NFT
  genesisNftMint?: string;
  
  // Fee tracking
  gorFeesClaimed: string;
  tokenFeesClaimed: string;
  
  // Unwind
  unwindClaimed: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const DepositSchema = new Schema<IDeposit>({
  publicKey: { type: String, required: true, unique: true, index: true },
  
  sovereign: { type: String, required: true, index: true },
  depositor: { type: String, required: true, index: true },
  
  amount: { type: String, required: true },
  sharesBps: { type: Number, default: 0 },
  
  genesisNftMint: String,
  
  gorFeesClaimed: { type: String, default: '0' },
  tokenFeesClaimed: { type: String, default: '0' },
  
  unwindClaimed: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Compound indexes
DepositSchema.index({ sovereign: 1, depositor: 1 }, { unique: true });
DepositSchema.index({ depositor: 1, createdAt: -1 });

export const Deposit = mongoose.model<IDeposit>('Deposit', DepositSchema);
