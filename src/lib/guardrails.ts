/**
 * Input validation and content guardrails.
 * Prevents abuse, prompt injection, and off-topic queries.
 */

const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;

// Patterns that suggest prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions|prompts)/i,
  /you\s+are\s+now\s+/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+(?!a\s+(guitar|sound|audio))/i,
  /system\s*prompt/i,
  /reveal\s+your\s+(instructions|prompt|system)/i,
  /forget\s+(everything|all|your)/i,
  /new\s+instruction/i,
  /override\s+(your|the)\s+(rules|instructions)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

// Blocked content patterns
const BLOCKED_PATTERNS = [
  /\b(hack|exploit|crack|pirate)\b.*\b(software|firmware|license)\b/i,
  /how\s+to\s+(steal|pirate|crack)/i,
];

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  sanitized?: string;
}

export function validateInput(message: string): ValidationResult {
  // Length checks
  if (message.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, reason: "Message is too short." };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: true,
      sanitized: message.substring(0, MAX_MESSAGE_LENGTH),
      reason: "Message was trimmed to maximum length.",
    };
  }

  // Prompt injection detection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        valid: false,
        reason:
          "I'm PeaveyPro. I can help you with questions about Peavey products, setup, troubleshooting, and more. What can I help you with?",
      };
    }
  }

  // Blocked content
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      return {
        valid: false,
        reason:
          "I can only help with Peavey product questions. Please ask about setup, specs, troubleshooting, or tone recommendations.",
      };
    }
  }

  // Strip HTML/script tags
  const sanitized = message.replace(/<[^>]*>/g, "").trim();

  return { valid: true, sanitized };
}

/**
 * Detect which products are being discussed in a message
 */
export function detectProducts(message: string): string[] {
  const lower = message.toLowerCase();
  const products: string[] = [];

  if (/6505|5150|tube\s*amp|guitar\s*amp/.test(lower)) products.push("6505 1992 Original");
  if (/pv\s*14|pv14|mixer|mixing\s*console|bluetooth\s*mixer/.test(lower)) products.push("PV14AT/PV14BT");
  if (/auto[\s-]*tune/.test(lower)) products.push("PV14AT (Auto-Tune)");
  if (/vypyr|modeling/.test(lower)) products.push("Vypyr Series");
  if (/invective|misha/.test(lower)) products.push("invective Series");
  if (/classic\s*(20|30|50)/.test(lower)) products.push("Classic Series");

  return products;
}
