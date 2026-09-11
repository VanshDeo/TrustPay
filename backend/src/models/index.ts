/**
 * Mongoose models for TrustPay.
 * Collections: users, payments, approvals, transactions
 */
import mongoose, { Schema, Document } from 'mongoose';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  walletAddress: string;
  createdAt: Date;
  lastSeen: Date;
}

const UserSchema = new Schema<IUser>({
  walletAddress: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>('User', UserSchema);

// ─── Payment ──────────────────────────────────────────────────────────────────

export interface IPayment extends Document {
  escrowId: string;
  senderAddress: string;
  beneficiaryAddress: string;
  tokenAddress: string;
  amount: string; // stored as string to handle large numbers (total)
  milestones: { amount: string; status: 'pending' | 'released' }[];
  status: 'pending' | 'released' | 'cancelled' | 'timed_out' | 'frozen';
  threshold: number;
  arbitrator?: string;
  approvers: string[];
  shareLink: string;
  /** Ledger timestamp after which timeout activates. 0 = no deadline. */
  deadline: number;
  /** What happens on timeout: refund_sender or release_beneficiary */
  fallback: 'refund_sender' | 'release_beneficiary';
  /** Walletless payment fields */
  walletless?: boolean;
  walletlessSender?: boolean;
  temporaryPublicKey?: string;
  temporarySenderPublicKey?: string;
  claimPinHash?: string;
  evidenceHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  escrowId: { type: String, required: true, unique: true, index: true },
  senderAddress: { type: String, required: true, index: true },
  beneficiaryAddress: { type: String, required: true },
  tokenAddress: { type: String, required: true },
  amount: { type: String, required: true },
  milestones: [{
    amount: { type: String, required: true },
    status: { type: String, enum: ['pending', 'released'], default: 'pending' }
  }],
  status: { type: String, enum: ['pending', 'released', 'cancelled', 'timed_out', 'frozen'], default: 'pending' },
  threshold: { type: Number, required: true },
  arbitrator: { type: String },
  approvers: [{ type: String }],
  shareLink: { type: String, unique: true, index: true },
  deadline: { type: Number, default: 0 },
  fallback: { type: String, enum: ['refund_sender', 'release_beneficiary'], default: 'refund_sender' },
  walletless: { type: Boolean, default: false },
  walletlessSender: { type: Boolean, default: false },
  temporaryPublicKey: { type: String },
  temporarySenderPublicKey: { type: String },
  claimPinHash: { type: String },
  evidenceHash: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

// ─── Approval ─────────────────────────────────────────────────────────────────

export interface IApproval extends Document {
  paymentId: mongoose.Types.ObjectId;
  escrowId: string;
  milestoneId: number;
  approverAddress: string;
  approvedAt: Date;
  txHash: string;
}

const ApprovalSchema = new Schema<IApproval>({
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
  escrowId: { type: String, required: true, index: true },
  milestoneId: { type: Number, required: true, default: 0 },
  approverAddress: { type: String, required: true },
  approvedAt: { type: Date, default: Date.now },
  txHash: { type: String },
});

export const Approval = mongoose.model<IApproval>('Approval', ApprovalSchema);

// ─── Transaction (indexed from blockchain events) ─────────────────────────────

export interface ITransaction extends Document {
  txHash: string;
  eventType: string;
  contractId: string;
  data: Record<string, any>;
  ledgerSequence: number;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  txHash: { type: String, unique: true, index: true },
  eventType: { type: String, required: true, index: true },
  contractId: { type: String, required: true },
  data: { type: Schema.Types.Mixed },
  ledgerSequence: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
