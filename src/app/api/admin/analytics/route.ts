/**
 * Admin Analytics API
 * Returns chat analytics data for the admin dashboard.
 */
import { getAnalytics, getAllSessions, getSessionMessages } from "@/lib/chat-storage";

export async function GET(req: Request) {
  // Simple auth check — in production, use proper authentication
  const authHeader = req.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;

  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analytics = await getAnalytics();

  return Response.json(analytics);
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;

  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, sessionId } = await req.json();

  if (action === "session_messages" && sessionId) {
    const messages = await getSessionMessages(sessionId);
    return Response.json({ messages });
  }

  if (action === "all_sessions") {
    const sessions = await getAllSessions(100);
    return Response.json({ sessions });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
