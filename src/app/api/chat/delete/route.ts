/**
 * GDPR Data Deletion Endpoint
 * Allows users to request deletion of their chat data.
 */
import { deleteSession, getSession } from "@/lib/chat-storage";

export async function DELETE(req: Request) {
  const { sessionId } = await req.json();

  if (!sessionId) {
    return Response.json({ error: "Session ID required" }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  await deleteSession(sessionId);

  return Response.json({
    success: true,
    message: "All chat data for this session has been permanently deleted.",
  });
}
