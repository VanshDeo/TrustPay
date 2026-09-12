/**
 * Explain Before You Sign — Client-side transaction decoding & plain-language explainer.
 * Decodes Soroban invocations into human-readable sentences and safety assessments.
 */

export interface TransactionExplanation {
  functionName: string;
  summary: string; // The primary plain-English sentence
  details: {
    label: string;
    value: string;
    highlight?: boolean;
  }[];
  financialImpact: {
    amount: string;
    token: string;
    direction: 'outflow' | 'inflow' | 'locked' | 'neutral';
  };
  conditions: string[];
  safety: {
    level: 'safe' | 'info' | 'warning';
    message: string;
  };
}

export interface ExplainParams {
  functionName: string;
  amount?: string;
  token?: string;
  beneficiary?: string;
  sender?: string;
  milestones?: string[];
  threshold?: number;
  totalApprovers?: number;
  deadlineDays?: number;
  fallback?: string;
  arbitrator?: string;
  escrowId?: string | number;
  isFirstTimeAddress?: boolean;
}

/**
 * Explains a known TrustPay Soroban contract invocation using clear, deterministic templates.
 */
export function explainTransaction(params: ExplainParams): TransactionExplanation {
  const {
    functionName,
    amount = '0',
    token = 'XLM',
    beneficiary = '',
    sender = '',
    milestones = [],
    threshold = 1,
    totalApprovers = 1,
    deadlineDays = 0,
    fallback = 'refund',
    arbitrator = '',
    escrowId = '',
    isFirstTimeAddress = false,
  } = params;

  switch (functionName) {
    case 'create_escrow': {
      const milestoneText =
        milestones.length > 1
          ? ` across ${milestones.length} milestones`
          : '';
      const fallbackAction = fallback === 'refund' ? 'automatically refund back to you' : 'automatically release to the recipient';
      const deadlineText = deadlineDays > 0 ? ` If no decision is made within ${deadlineDays} day(s), funds will ${fallbackAction}.` : '';

      const summary = `You are locking ${amount} ${token} into protected escrow for ${
        beneficiary ? formatAddress(beneficiary) : 'the recipient'
      }${milestoneText}.${deadlineText}`;

      const details = [
        { label: 'Total Locked', value: `${amount} ${token}`, highlight: true },
        { label: 'Recipient', value: beneficiary ? formatAddress(beneficiary) : 'Claimable Link (Walletless)' },
        { label: 'Approval Rule', value: `${threshold} of ${Math.max(threshold, totalApprovers)} approvals required` },
      ];

      if (milestones.length > 1) {
        details.push({
          label: 'Milestones',
          value: milestones.map((m, i) => `#${i + 1}: ${m} ${token}`).join(', '),
        });
      }

      if (deadlineDays > 0) {
        details.push({
          label: 'Timeout Rule',
          value: `${deadlineDays} day(s) → ${fallback.toUpperCase()}`,
        });
      }

      if (arbitrator) {
        details.push({
          label: 'Arbitrator',
          value: formatAddress(arbitrator),
        });
      }

      const conditions = [
        `Funds cannot be withdrawn arbitrarily; they unlock only when ${threshold} approver(s) sign off.`,
      ];
      if (deadlineDays > 0) {
        conditions.push(`If inactive after ${deadlineDays} days, keeper resolution will ${fallback} funds.`);
      }
      if (arbitrator) {
        conditions.push(`The designated arbitrator has authority to resolve disputes.`);
      }

      let safety: TransactionExplanation['safety'] = {
        level: 'safe',
        message: 'Funds will be securely held in the Soroban smart contract.',
      };

      if (isFirstTimeAddress) {
        safety = {
          level: 'warning',
          message: 'This is the first time you are interacting with this recipient address. Double check the address.',
        };
      }

      return {
        functionName,
        summary,
        details,
        financialImpact: {
          amount,
          token,
          direction: 'locked',
        },
        conditions,
        safety,
      };
    }

    case 'approve': {
      const summary = `You are voting to approve the release of funds for escrow #${escrowId}.`;
      return {
        functionName,
        summary,
        details: [
          { label: 'Escrow ID', value: `#${escrowId}`, highlight: true },
          { label: 'Action', value: 'Approval Vote' },
        ],
        financialImpact: {
          amount: '0',
          token,
          direction: 'neutral',
        },
        conditions: ['Once the approval threshold is reached, funds can be released to the beneficiary.'],
        safety: {
          level: 'info',
          message: 'Approvals are on-chain and irrevocable once confirmed.',
        },
      };
    }

    case 'release': {
      const summary = `You are releasing ${amount} ${token} from escrow #${escrowId} to ${formatAddress(beneficiary)}.`;
      return {
        functionName,
        summary,
        details: [
          { label: 'Escrow ID', value: `#${escrowId}` },
          { label: 'Amount Released', value: `${amount} ${token}`, highlight: true },
          { label: 'Beneficiary', value: formatAddress(beneficiary) },
        ],
        financialImpact: {
          amount,
          token,
          direction: 'outflow',
        },
        conditions: ['Funds will immediately transfer to the beneficiary wallet.'],
        safety: {
          level: 'warning',
          message: 'This action is irreversible. Released funds cannot be clawed back.',
        },
      };
    }

    case 'freeze_pending': {
      const summary = `You (as guardian) are emergency-freezing escrow #${escrowId} to halt all release actions.`;
      return {
        functionName,
        summary,
        details: [
          { label: 'Escrow ID', value: `#${escrowId}`, highlight: true },
          { label: 'Guardian Action', value: 'Emergency Halt' },
        ],
        financialImpact: {
          amount: '0',
          token,
          direction: 'neutral',
        },
        conditions: ['Prevents any approval or release execution until the freeze is lifted.'],
        safety: {
          level: 'warning',
          message: 'Freezing halts contract execution immediately.',
        },
      };
    }

    case 'claim': {
      const summary = `You are claiming ${amount} ${token} from protected escrow #${escrowId}.`;
      return {
        functionName,
        summary,
        details: [
          { label: 'Claim Amount', value: `${amount} ${token}`, highlight: true },
          { label: 'Escrow ID', value: `#${escrowId}` },
        ],
        financialImpact: {
          amount,
          token,
          direction: 'inflow',
        },
        conditions: ['Funds will be transferred directly to your connected wallet.'],
        safety: {
          level: 'safe',
          message: 'Funds will deposit directly into your Stellar account.',
        },
      };
    }

    case 'set_spending_limit': {
      const summary = `You are configuring a policy spending limit of ${amount} ${token} on your Smart Wallet.`;
      return {
        functionName,
        summary,
        details: [
          { label: 'Max Per Tx', value: `${amount} ${token}`, highlight: true },
          { label: 'Scope', value: 'Smart Wallet Policy Engine' },
        ],
        financialImpact: {
          amount: '0',
          token,
          direction: 'neutral',
        },
        conditions: ['All outgoing transfers exceeding this amount will be rejected automatically on-chain.'],
        safety: {
          level: 'safe',
          message: 'This policy enforces strict bounded spending for human and AI agent keys.',
        },
      };
    }

    default: {
      const summary = `You are executing "${functionName}" on the TrustPay contract.`;
      return {
        functionName,
        summary,
        details: [{ label: 'Contract Function', value: functionName }],
        financialImpact: {
          amount: amount || '0',
          token,
          direction: 'neutral',
        },
        conditions: ['Contract call will execute on Stellar Testnet.'],
        safety: {
          level: 'info',
          message: 'Verify transaction parameters carefully.',
        },
      };
    }
  }
}

function formatAddress(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
}
