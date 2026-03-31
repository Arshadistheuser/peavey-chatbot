import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { searchManuals } from "@/lib/tools/search-manuals";
import { findProductImages } from "@/lib/tools/find-images";
import { compareProducts } from "@/lib/tools/compare-products";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateInput, detectProducts } from "@/lib/guardrails";
import { createSession, addMessage, updateProductsDiscussed } from "@/lib/chat-storage";

export const maxDuration = 60;

// Simple greeting detection — don't force tool calls for greetings
const GREETING_PATTERNS = /^(hi|hello|hey|howdy|sup|yo|good\s*(morning|afternoon|evening)|thanks|thank you|bye|goodbye)[\s!?.]*$/i;

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const country = req.headers.get("x-vercel-ip-country") || "unknown";
  const city = req.headers.get("x-vercel-ip-city") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const referer = req.headers.get("referer") || "";

  // Rate limiting
  const rateLimitResult = await checkRateLimit(ip);
  if (!rateLimitResult.success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please wait a moment before sending another message.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
        },
      }
    );
  }

  const { messages, sessionId }: { messages: UIMessage[]; sessionId?: string } =
    await req.json();

  // Extract and validate the latest user message
  const lastMessage = messages[messages.length - 1];
  let userContent = "";
  let isGreeting = false;

  if (lastMessage?.role === "user") {
    userContent = (lastMessage.parts || [])
      .filter((p) => p.type === "text")
      .map((p) => ("text" in p ? p.text : ""))
      .join("");

    const validation = validateInput(userContent);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.reason }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use sanitized input if available
    const cleanContent = validation.sanitized || userContent;

    isGreeting = GREETING_PATTERNS.test(cleanContent);

    // Store session and message in background (with logging on failure)
    if (sessionId) {
      createSession({
        id: sessionId,
        userIp: ip,
        userCountry: country,
        userCity: city,
        referrerUrl: referer,
        pageUrl: referer,
        userAgent,
      }).catch((e) => console.error("[chat] session creation failed:", e));

      addMessage(sessionId, "user", cleanContent).catch((e) =>
        console.error("[chat] message storage failed:", e)
      );

      const products = detectProducts(cleanContent);
      if (products.length > 0) {
        updateProductsDiscussed(sessionId, products).catch((e) =>
          console.error("[chat] product tracking failed:", e)
        );
      }
    }
  }

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      searchManuals,
      findProductImages,
      compareProducts,
    },
    toolChoice: "auto",
    maxOutputTokens: 4000,
    stopWhen: stepCountIs(20),
    onFinish: async ({ text }) => {
      if (sessionId && text) {
        addMessage(sessionId, "assistant", text).catch((e) =>
          console.error("[chat] assistant message storage failed:", e)
        );
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
