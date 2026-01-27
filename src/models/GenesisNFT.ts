import mongoose, { Document, Schema } from 'mongoose';

export interface IGenesisNFT extends Document {
  // Identity
  mint: string;                // NFT mint address
  
  // Ownership
  owner: string;               // Current owner wallet
  
  // References
  sovereign: string;           // Sovereign publicKey
  deposit: string;             // Deposit publicKey
  
  // Share info
  sharesBps: number;           // basis points
  depositAmount: string;       // original deposit amount
  
  // Metadata
  name: string;
  symbol: string;
  uri?: string;
  
  // Timestamps
  mintedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GenesisNFTSchema = new Schema<IGenesisNFT>({
  mint: { type: String, required: true, unique: true, index: true },
  
  owner: { type: String, required: true, index: true },
  
  sovereign: { type: String, required: true, index: true },
  deposit: { type: String, required: true },
  
  sharesBps: { type: Number, required: true },
  depositAmount: { type: String, required: true },
  
  name: { type: String, required: true },
  symbol: { type: String, default: 'GSLP' },
  uri: String,
  
  mintedAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// Indexes
GenesisNFTSchema.index({ owner: 1, sovereign: 1 });

export const GenesisNFT = mongoose.model<IGenesisNFT>('GenesisNFT', GenesisNFTSchema);
