/**
 * HubSpot CRM Integration
 * Creates contacts, logs chat transcripts as notes.
 * Requires: HUBSPOT_ACCESS_TOKEN env var from a HubSpot Private App.
 * HubSpot CRM free tier supports unlimited contacts + full API access.
 */

import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts/models/Filter";

let hubspotClient: Client | null = null;

function getHubSpot(): Client | null {
  if (hubspotClient) return hubspotClient;
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
    return hubspotClient;
  }
  return null;
}

export function isHubSpotConfigured(): boolean {
  return !!process.env.HUBSPOT_ACCESS_TOKEN;
}

export async function createOrUpdateContact(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  country?: string;
  city?: string;
  pageUrl?: string;
  productsDiscussed?: string[];
}): Promise<string | null> {
  const client = getHubSpot();
  if (!client) return null;

  const properties: Record<string, string> = {
    email: data.email,
    firstname: data.firstName || "",
    lastname: data.lastName || "",
    phone: data.phone || "",
    company: data.company || "",
    country: data.country || "",
    city: data.city || "",
    hs_lead_status: "NEW",
    lifecyclestage: "lead",
  };

  try {
    const contact = await client.crm.contacts.basicApi.create({
      properties,
      associations: [],
    });
    return contact.id;
  } catch (error: unknown) {
    // If contact exists (409), search and update
    const err = error as { code?: number; body?: { message?: string } };
    if (err.code === 409) {
      try {
        const search = await client.crm.contacts.searchApi.doSearch({
          filterGroups: [
            {
              filters: [
                { propertyName: "email", operator: FilterOperatorEnum.Eq, value: data.email },
              ],
            },
          ],
          properties: ["email"],
          limit: 1,
          after: "0",
          sorts: [],
        });
        if (search.results.length > 0) {
          const existingId = search.results[0].id;
          await client.crm.contacts.basicApi.update(existingId, { properties });
          return existingId;
        }
      } catch {
        console.error("[hubspot] Failed to search/update contact");
      }
    }
    console.error("[hubspot] Failed to create contact:", err);
    return null;
  }
}

export async function logChatTranscript(
  contactId: string,
  transcript: string,
  meta: {
    sessionId: string;
    duration: number;
    productsDiscussed: string[];
    country: string;
  }
): Promise<string | null> {
  const client = getHubSpot();
  if (!client) return null;

  const noteBody = `
<h3>Peavey Chatbot Conversation</h3>
<p><strong>Session ID:</strong> ${meta.sessionId}</p>
<p><strong>Duration:</strong> ${Math.round(meta.duration / 60)} minutes</p>
<p><strong>Country:</strong> ${meta.country}</p>
<p><strong>Products Discussed:</strong> ${meta.productsDiscussed.join(", ") || "None identified"}</p>
<hr/>
${transcript}
  `.trim();

  try {
    const note = await client.crm.objects.notes.basicApi.create({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: noteBody,
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED" as never,
              associationTypeId: 202,
            },
          ],
        },
      ],
    });
    return note.id;
  } catch (error) {
    console.error("[hubspot] Failed to log transcript:", error);
    return null;
  }
}

export async function syncSessionToHubSpot(data: {
  sessionId: string;
  email: string;
  name?: string;
  phone?: string;
  country?: string;
  city?: string;
  productsDiscussed?: string[];
  durationSeconds?: number;
  messages: Array<{ role: string; content: string; created_at: string }>;
}): Promise<{ contactId: string; noteId: string } | null> {
  if (!data.email) return null;

  const nameParts = (data.name || "").split(" ");
  const contactId = await createOrUpdateContact({
    email: data.email,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" "),
    phone: data.phone,
    country: data.country,
    city: data.city,
    productsDiscussed: data.productsDiscussed,
  });

  if (!contactId) return null;

  const transcript = data.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const role = m.role === "user" ? "👤 Customer" : "🤖 Assistant";
      return `<p><strong>${role}:</strong> ${m.content}</p>`;
    })
    .join("\n");

  const noteId = await logChatTranscript(contactId, transcript, {
    sessionId: data.sessionId,
    duration: data.durationSeconds || 0,
    productsDiscussed: data.productsDiscussed || [],
    country: data.country || "Unknown",
  });

  return noteId ? { contactId, noteId } : null;
}
