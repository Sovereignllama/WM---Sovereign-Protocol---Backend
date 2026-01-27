import mongoose, { Document, Schema } from 'mongoose';

export type EventType = 
  | 'SovereignCreated'
  | 'Deposit'
  | 'Withdraw'
  | 'SovereignFinalized'
  | 'SovereignFailed'
  | 'FeesClaimed'
  | 'ProposalCreated'
  | 'VoteCast'
  | 'ProposalExecuted'
  | 'ActivityCheckInitiated'
  | 'ActivityCheckExecuted'
  | 'ActivityCheckCancelled'
  | 'SovereignUnwound'
  | 'UnwindClaimed'
  | 'GenesisNFTMinted'
  | 'GenesisNFTTransferred';

export interface IEvent extends Document {
  // Transaction info
  txSignature: string;
  slot: number;
  blockTime: Date;
  
  // Event info
  eventType: EventType;
  
  // References (optional based on event type)
  sovereign?: string;
  depositor?: string;
  nftMint?: string;
  proposal?: string;
  
  // Event-specific data
  data: Record<string, unknown>;
  
  // Timestamps
  createdAt: Date;
}

const EventSchema = new Schema<IEvent>({
  txSignature: { type: String, required: true, index: true },
  slot: { type: Number, required: true },
  blockTime: { type: Date, required: true },
  
  eventType: { 
    type: String, 
    required: true,
    index: true 
  },
  
  sovereign: { type: String, index: true },
  depositor: { type: String, index: true },
  nftMint: String,
  proposal: String,
  
  data: { type: Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

// Indexes for event queries
EventSchema.index({ sovereign: 1, eventType: 1, blockTime: -1 });
EventSchema.index({ depositor: 1, eventType: 1, blockTime: -1 });
EventSchema.index({ blockTime: -1 });

// Prevent duplicate events
EventSchema.index({ txSignature: 1, eventType: 1 }, { unique: true });

export const Event = mongoose.model<IEvent>('Event', EventSchema);
