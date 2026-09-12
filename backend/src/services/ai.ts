/**
 * AI Deal Builder Service — parses natural language deal descriptions
 * into structured TrustPay escrow and policy parameters.
 */

export interface ParsedDeal {
  title: string;
  amount: string; // Total amount in XLM
  milestones: string[]; // Milestone amounts in XLM
  beneficiary?: string; // Stellar address if mentioned, or empty
  walletlessRecipient: boolean;
  threshold: number;
  approvers: string[];
  deadlineDays?: number;
  deadlineSeconds?: number;
  fallback: 'refund' | 'release';
  arbitrator?: string;
  summary: string;
}

const SYSTEM_PROMPT = `
You are the TrustPay AI Deal Builder. Your job is to convert natural language deal descriptions into a structured JSON configuration for a Stellar/Soroban conditional escrow payment.

Strictly respond with a valid JSON object only (no markdown, no code fence, no additional commentary) matching this TypeScript interface:
{
  "title": string,
  "amount": string, // total XLM amount (as decimal or integer string, e.g. "500")
  "milestones": string[], // array of individual milestone amounts in XLM, sum must equal amount. If no milestones mentioned, one element matching amount.
  "beneficiary": string, // Stellar public key (starting with G) if provided, otherwise ""
  "walletlessRecipient": boolean, // true if recipient has no wallet, or if an email/name/link is mentioned without a G... address
  "threshold": number, // required number of approvals, default 1
  "approvers": string[], // array of approver Stellar public keys (G...) or descriptions. If none specified, empty array.
  "deadlineDays": number, // duration in days before timeout, 0 if none
  "deadlineSeconds": number, // duration in seconds (deadlineDays * 86400), 0 if none
  "fallback": "refund" | "release", // default "refund" if deadline passes without approval
  "arbitrator": string, // Stellar public key of arbitrator if specified, otherwise ""
  "summary": string // 1-2 sentence plain-English summary of the deal
}
`;

/**
 * Heuristic rule-based fallback parser for when AI API is unavailable, unconfigured, or fails.
 */
export function heuristicParseDeal(prompt: string): ParsedDeal {
  const text = prompt.trim();

  // 1. Extract total amount (look for numbers followed by XLM, lumens, or standalone numbers)
  let amount = "100";
  const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:xlm|lumens|\$|usdc)?/i);
  if (amountMatch && parseFloat(amountMatch[1]) > 0) {
    amount = amountMatch[1];
  }

  // 2. Check for milestones
  let milestones: string[] = [amount];
  const milestoneCountMatch = text.match(/(\d+)\s*(?:equal\s*)?milestones?/i);
  const splitMatch = text.match(/split\s*(?:in|into)\s*(\d+)/i);

  const numMilestones = milestoneCountMatch
    ? parseInt(milestoneCountMatch[1], 10)
    : splitMatch
    ? parseInt(splitMatch[1], 10)
    : 1;

  if (numMilestones > 1) {
    const total = parseFloat(amount);
    const perMilestone = (total / numMilestones).toFixed(2).replace(/\.00$/, "");
    milestones = Array(numMilestones).fill(perMilestone);
    // Correct rounding for the last milestone
    const allocated = parseFloat(perMilestone) * (numMilestones - 1);
    const last = (total - allocated).toFixed(2).replace(/\.00$/, "");
    milestones[milestones.length - 1] = last;
  }

  // Look for specific milestone amounts (e.g. "250 on start, 250 on delivery")
  const specificMilestoneMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:xlm)?\s*(?:on|for|upon)/gi)];
  if (specificMilestoneMatches.length >= 2) {
    const extracted = specificMilestoneMatches.map((m) => m[1]);
    const sum = extracted.reduce((acc, val) => acc + parseFloat(val), 0);
    if (sum > 0) {
      milestones = extracted;
      amount = sum.toString();
    }
  }

  // 3. Deadline extraction
  let deadlineDays = 0;
  const deadlineMatch = text.match(/(\d+)\s*(?:day|days|d)\b/i);
  const weekMatch = text.match(/(\d+)\s*(?:week|weeks|w)\b/i);
  const monthMatch = text.match(/(\d+)\s*(?:month|months|m)\b/i);

  if (deadlineMatch) {
    deadlineDays = parseInt(deadlineMatch[1], 10);
  } else if (weekMatch) {
    deadlineDays = parseInt(weekMatch[1], 10) * 7;
  } else if (monthMatch) {
    deadlineDays = parseInt(monthMatch[1], 10) * 30;
  }

  // 4. Fallback resolution
  let fallback: 'refund' | 'release' = 'refund';
  if (/release|auto-release|pay\s+recipient/i.test(text) && !/refund/i.test(text)) {
    fallback = 'release';
  }

  // 5. Look for Stellar public keys
  const stellarAddresses = text.match(/G[A-Z0-9]{55}/g) || [];
  let beneficiary = "";
  let arbitrator = "";
  let approvers: string[] = [];

  if (stellarAddresses.length > 0) {
    beneficiary = stellarAddresses[0] || "";
    if (stellarAddresses.length > 1) {
      arbitrator = stellarAddresses[1] || "";
    }
    if (stellarAddresses.length > 2) {
      approvers = stellarAddresses.slice(2);
    }
  }

  // 6. Walletless check
  const walletlessRecipient = !beneficiary || /walletless|no wallet|email|phone|link/i.test(text);

  // 7. Threshold
  let threshold = approvers.length > 0 ? approvers.length : 1;
  const thresholdMatch = text.match(/(\d+)\s*(?:of|\/)\s*(\d+)\s*approv/i);
  if (thresholdMatch) {
    threshold = parseInt(thresholdMatch[1], 10);
  }

  // 8. Title & Summary
  const title = text.length > 40 ? text.substring(0, 37) + "..." : text;
  const summary = `Escrow payment of ${amount} XLM across ${milestones.length} milestone(s)${
    deadlineDays ? ` with a ${deadlineDays}-day timeout (${fallback} fallback)` : ''
  }.`;

  return {
    title,
    amount,
    milestones,
    beneficiary,
    walletlessRecipient,
    threshold,
    approvers,
    deadlineDays,
    deadlineSeconds: deadlineDays * 86400,
    fallback,
    arbitrator,
    summary,
  };
}

/**
 * Main parser function. Attempts Gemini LLM first, falls back to heuristic on failure.
 */
export async function parseDealPrompt(prompt: string): Promise<ParsedDeal> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (process.env.NODE_ENV === 'test' || !apiKey || apiKey.trim() === '') {
    return heuristicParseDeal(prompt);
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nUser deal prompt:\n"${prompt}"`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`[AI Deal Builder] Gemini API returned status ${response.status}. Using heuristic fallback.`);
      return heuristicParseDeal(prompt);
    }

    const data: any = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidate) {
      console.warn('[AI Deal Builder] Empty response from Gemini API. Using heuristic fallback.');
      return heuristicParseDeal(prompt);
    }

    const parsed: ParsedDeal = JSON.parse(candidate);

    // Sanity checks on parsed values
    if (!parsed.amount || isNaN(parseFloat(parsed.amount))) {
      parsed.amount = "100";
    }
    if (!parsed.milestones || !Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
      parsed.milestones = [parsed.amount];
    }
    if (!parsed.fallback || (parsed.fallback !== 'refund' && parsed.fallback !== 'release')) {
      parsed.fallback = 'refund';
    }
    if (!parsed.threshold || parsed.threshold < 1) {
      parsed.threshold = 1;
    }
    if (!parsed.approvers || !Array.isArray(parsed.approvers)) {
      parsed.approvers = [];
    }
    if (parsed.deadlineDays && !parsed.deadlineSeconds) {
      parsed.deadlineSeconds = parsed.deadlineDays * 86400;
    }

    return parsed;
  } catch (err) {
    console.warn('[AI Deal Builder] Error calling Gemini API. Falling back to heuristic parser:', err);
    return heuristicParseDeal(prompt);
  }
}
