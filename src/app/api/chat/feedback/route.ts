/**
 * Feedback endpoint — stores thumbs up/down ratings per message.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const FEEDBACK_PATH = path.join(process.cwd(), "data", "feedback.json");

interface FeedbackEntry {
  sessionId: string;
  messageIndex: number;
  rating: "up" | "down";
  timestamp: string;
  query?: string;
}

function loadFeedback(): FeedbackEntry[] {
  if (existsSync(FEEDBACK_PATH)) {
    try { return JSON.parse(readFileSync(FEEDBACK_PATH, "utf-8")); } catch { return []; }
  }
  return [];
}

function saveFeedback(entries: FeedbackEntry[]) {
  writeFileSync(FEEDBACK_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

export async function POST(req: Request) {
  const { sessionId, messageIndex, rating, query } = await req.json();

  if (!sessionId || messageIndex === undefined || !["up", "down"].includes(rating)) {
    return Response.json({ error: "Invalid feedback data" }, { status: 400 });
  }

  const entries = loadFeedback();
  entries.push({ sessionId, messageIndex, rating, timestamp: new Date().toISOString(), query });
  saveFeedback(entries);

  return Response.json({ success: true });
}

export async function GET() {
  const entries = loadFeedback();
  const total = entries.length;
  const positive = entries.filter(e => e.rating === "up").length;
  const rate = total > 0 ? Math.round((positive / total) * 100) : 0;

  return Response.json({
    total,
    positive,
    negative: total - positive,
    helpfulnessRate: `${rate}%`,
    recentNegative: entries.filter(e => e.rating === "down").slice(-10).reverse(),
  });
}
