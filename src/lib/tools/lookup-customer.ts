import { tool } from "ai";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";

interface Order {
  orderId: string;
  date: string;
  product: string;
  sku: string;
  price: number;
  status: string;
  warranty: string;
}

interface SupportTicket {
  ticketId: string;
  date: string;
  subject: string;
  status: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  memberSince: string;
  tier: string;
  totalSpent: number;
  orders: Order[];
  supportTickets: SupportTicket[];
  notes: string;
}

// Load mock customer data
let customers: Customer[] = [];
try {
  const data = readFileSync(join(process.cwd(), "data", "mock-customers.json"), "utf-8");
  customers = JSON.parse(data);
} catch {
  console.warn("[lookup-customer] Could not load mock customer data");
}

function searchCustomers(query: string): Customer | null {
  const q = query.toLowerCase().trim();

  // Exact ID match
  const byId = customers.find((c) => c.id.toLowerCase() === q);
  if (byId) return byId;

  // Email match
  const byEmail = customers.find((c) => c.email.toLowerCase() === q);
  if (byEmail) return byEmail;

  // Phone match (strip non-digits for comparison)
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length >= 7) {
    const byPhone = customers.find((c) => c.phone.replace(/\D/g, "").includes(qDigits));
    if (byPhone) return byPhone;
  }

  // Order ID match
  const byOrder = customers.find((c) => c.orders.some((o) => o.orderId.toLowerCase() === q));
  if (byOrder) return byOrder;

  // Name match (partial)
  const byName = customers.find((c) => c.name.toLowerCase().includes(q));
  if (byName) return byName;

  return null;
}

export const lookupCustomer = tool({
  description:
    "Look up a customer in the CRM by their customer ID, name, email, phone number, or order ID. Returns their profile, purchase history, support tickets, and account notes. Use this when a customer mentions their ID, name, email, or order number.",
  parameters: z.object({
    query: z
      .string()
      .default("")
      .describe(
        "The customer identifier to search for. REQUIRED. Can be a customer ID (e.g. CUST-10042), name, email, phone number, or order ID (e.g. ORD-78234). Extract this from the user's message."
      ),
  }),
  execute: async ({ query }) => {
    if (!query || !query.trim()) {
      return {
        found: false,
        message: "No search query provided. Please specify a customer ID (CUST-XXXXX), name, email, phone, or order ID (ORD-XXXXX).",
      };
    }
    const customer = searchCustomers(query);

    if (!customer) {
      return {
        found: false,
        message: `No customer found matching "${query}". Try searching by customer ID (CUST-XXXXX), email, phone, or full name.`,
      };
    }

    const activeWarranties = customer.orders.filter(
      (o) => o.warranty !== "Expired" && o.warranty !== "N/A" && o.warranty !== "Pending"
    );
    const openTickets = customer.supportTickets.filter((t) => t.status === "Open");

    return {
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        location: customer.location,
        memberSince: customer.memberSince,
        tier: customer.tier,
        totalSpent: `$${customer.totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        totalOrders: customer.orders.length,
        activeWarranties: activeWarranties.length,
        openSupportTickets: openTickets.length,
      },
      recentOrders: customer.orders.slice(0, 5).map((o) => ({
        orderId: o.orderId,
        date: o.date,
        product: o.product,
        price: `$${o.price.toFixed(2)}`,
        status: o.status,
        warrantyExpires: o.warranty,
      })),
      openTickets: openTickets.map((t) => ({
        ticketId: t.ticketId,
        date: t.date,
        subject: t.subject,
      })),
      notes: customer.notes,
    };
  },
});
