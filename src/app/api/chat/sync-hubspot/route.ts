/**
 * HubSpot CRM Sync Endpoint
 * Syncs a chat session to HubSpot as a contact + note.
 * Called when user provides their email during or after chat.
 */
import { syncSessionToHubSpot, isHubSpotConfigured } from "@/lib/hubspot";
import { getSession, getSessionMessages, updateSessionContact } from "@/lib/chat-storage";

export async function POST(req: Request) {
  if (!isHubSpotConfigured()) {
    return Response.json(
      { error: "HubSpot integration not configured" },
      { status: 501 }
    );
  }

  const { sessionId, email, name, phone } = await req.json();

  if (!sessionId || !email) {
    return Response.json(
      { error: "Session ID and email are required" },
      { status: 400 }
    );
  }

  // Update session with contact info
  await updateSessionContact(sessionId, { name, email, phone });

  // Get session data and messages
  const session = await getSession(sessionId);
  const messages = await getSessionMessages(sessionId);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  // Sync to HubSpot
  const result = await syncSessionToHubSpot({
    sessionId,
    email,
    name,
    phone,
    country: session.user_country,
    city: session.user_city,
    productsDiscussed: session.products_discussed,
    durationSeconds: session.session_duration_seconds,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    })),
  });

  if (result) {
    return Response.json({
      success: true,
      contactId: result.contactId,
      message: "Chat synced to HubSpot CRM",
    });
  }

  return Response.json(
    { error: "Failed to sync to HubSpot" },
    { status: 500 }
  );
}
