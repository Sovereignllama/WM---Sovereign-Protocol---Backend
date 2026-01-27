import mongoose, { Document, Schema } from 'mongoose';

export type ProposalStatus = 'Active' | 'Passed' | 'Failed' | 'Executed' | 'Cancelled';

export interface IProposal extends Document {
  // Identity
  publicKey: string;           // PDA address
  proposalId: number;
  
  // References
  sovereign: string;           // Sovereign publicKey
  proposer: string;            // Proposer wallet
  
  // Voting
  forVotes: string;            // lamports as string
  againstVotes: string;
  
  // Timing
  startTime: Date;
  endTime: Date;
  timelockEnd?: Date;
  
  // Status
  status: ProposalStatus;
  executed: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ProposalSchema = new Schema<IProposal>({
  publicKey: { type: String, required: true, unique: true, index: true },
  proposalId: { type: Number, required: true },
  
  sovereign: { type: String, required: true, index: true },
  proposer: { type: String, required: true, index: true },
  
  forVotes: { type: String, default: '0' },
  againstVotes: { type: String, default: '0' },
  
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  timelockEnd: Date,
  
  status: { 
    type: String, 
    enum: ['Active', 'Passed', 'Failed', 'Executed', 'Cancelled'],
    default: 'Active',
    index: true
  },
  executed: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Indexes
ProposalSchema.index({ sovereign: 1, proposalId: 1 }, { unique: true });
ProposalSchema.index({ status: 1, endTime: 1 });

export const Proposal = mongoose.model<IProposal>('Proposal', ProposalSchema);
