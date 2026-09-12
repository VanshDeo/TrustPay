import mongoose, { Schema, Document } from 'mongoose';

// ─── ApiKey ───────────────────────────────────────────────────────────────────

export interface IApiKey extends Document {
  keyId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  ownerAddress: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

const ApiKeySchema = new Schema<IApiKey>({
  keyId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  keyPrefix: { type: String, required: true },
  keyHash: { type: String, required: true },
  ownerAddress: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
});

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

// ─── AgentMandate ─────────────────────────────────────────────────────────────

export interface IAgentMandate extends Document {
  agentAddress: string; // Smart wallet contract address or agent key
  ownerAddress: string; // Human creator/owner address
  label: string;
  perTxLimit: string;
  perPeriodLimit: string;
  periodDuration: number; // in seconds
  periodUsed: string;
  periodStart: Date;
  tokenAddress: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentMandateSchema = new Schema<IAgentMandate>({
  agentAddress: { type: String, required: true, unique: true, index: true },
  ownerAddress: { type: String, required: true, index: true },
  label: { type: String, required: true },
  perTxLimit: { type: String, required: true },
  perPeriodLimit: { type: String, required: true },
  periodDuration: { type: Number, required: true, default: 86400 }, // default 1 day
  periodUsed: { type: String, default: '0' },
  periodStart: { type: Date, default: Date.now },
  tokenAddress: { type: String, default: 'USDC' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const AgentMandate = mongoose.model<IAgentMandate>('AgentMandate', AgentMandateSchema);

// ─── GatewayLog ───────────────────────────────────────────────────────────────

export interface IGatewayLog extends Document {
  requestId: string;
  resourceId: string;
  resourcePath: string;
  method: string;
  agentAddress?: string;
  amount: string;
  asset: string;
  destinationAddress: string;
  escrowCondition: {
    threshold: number;
    deadline: number;
    fallback: string;
    escrowContractId?: string;
  };
  httpStatus: number;
  status: 'payment_required' | 'escrow_created' | 'settled';
  escrowId?: string;
  rawRequestHeaders?: Record<string, any>;
  createdAt: Date;
  settledAt?: Date;
}

const GatewayLogSchema = new Schema<IGatewayLog>({
  requestId: { type: String, required: true, unique: true, index: true },
  resourceId: { type: String, required: true, index: true },
  resourcePath: { type: String, required: true },
  method: { type: String, default: 'GET' },
  agentAddress: { type: String, index: true },
  amount: { type: String, required: true },
  asset: { type: String, default: 'USDC' },
  destinationAddress: { type: String, required: true },
  escrowCondition: {
    threshold: { type: Number, default: 1 },
    deadline: { type: Number, default: 86400 },
    fallback: { type: String, default: 'refund_sender' },
    escrowContractId: { type: String },
  },
  httpStatus: { type: Number, required: true },
  status: {
    type: String,
    enum: ['payment_required', 'escrow_created', 'settled'],
    default: 'payment_required',
  },
  escrowId: { type: String, index: true },
  rawRequestHeaders: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
  settledAt: { type: Date },
});

export const GatewayLog = mongoose.model<IGatewayLog>('GatewayLog', GatewayLogSchema);
