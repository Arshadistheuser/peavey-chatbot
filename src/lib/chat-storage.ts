/**
 * Chat session storage.
 * Uses Supabase if configured, falls back to in-memory + JSON file storage.
 * Stores all chat sessions, messages, user metadata, and analytics.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

// Types
export interface ChatSession {
  id: string;
  created_at: string;
  updated_at: string;
  user_ip: string;
  user_country: string;
  user_city: string;
  referrer_url: string;
  page_url: string;
  user_agent: string;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  message_count: number;
  session_duration_seconds: number;
  products_discussed: string[];
  hubspot_contact_id: string | null;
  hubspot_synced_at: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

// Supabase client (if configured)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    return supabase;
  }
  return null;
}

// ===== Local file fallback =====
const SESSIONS_PATH = path.join(process.cwd(), "data", "chat-sessions.json");

interface LocalStore {
  sessions: ChatSession[];
  messages: ChatMessage[];
}

function loadLocalStore(): LocalStore {
  if (existsSync(SESSIONS_PATH)) {
    try {
      return JSON.parse(readFileSync(SESSIONS_PATH, "utf-8"));
    } catch {
      return { sessions: [], messages: [] };
    }
  }
  return { sessions: [], messages: [] };
}

function saveLocalStore(store: LocalStore) {
  writeFileSync(SESSIONS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

// ===== Public API =====

export async function createSession(data: {
  id: string;
  userIp: string;
  userCountry: string;
  userCity: string;
  referrerUrl: string;
  pageUrl: string;
  userAgent: string;
}): Promise<void> {
  const sb = getSupabase();

  const session: ChatSession = {
    id: data.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_ip: data.userIp,
    user_country: data.userCountry,
    user_city: data.userCity,
    referrer_url: data.referrerUrl,
    page_url: data.pageUrl,
    user_agent: data.userAgent,
    user_name: null,
    user_email: null,
    user_phone: null,
    message_count: 0,
    session_duration_seconds: 0,
    products_discussed: [],
    hubspot_contact_id: null,
    hubspot_synced_at: null,
  };

  if (sb) {
    await sb.from("chat_sessions").upsert(session);
  } else {
    const store = loadLocalStore();
    const existing = store.sessions.findIndex((s) => s.id === data.id);
    if (existing >= 0) {
      store.sessions[existing] = { ...store.sessions[existing], ...session };
    } else {
      store.sessions.push(session);
    }
    saveLocalStore(store);
  }
}

export async function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const sb = getSupabase();

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    role,
    content,
    created_at: new Date().toISOString(),
  };

  if (sb) {
    await sb.from("chat_messages").insert(message);
    const { count } = await sb
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    await sb
      .from("chat_sessions")
      .update({
        message_count: count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } else {
    const store = loadLocalStore();
    store.messages.push(message);
    const session = store.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.message_count = store.messages.filter((m) => m.session_id === sessionId).length;
      session.updated_at = new Date().toISOString();
    }
    saveLocalStore(store);
  }
}

export async function updateSessionContact(
  sessionId: string,
  data: { name?: string; email?: string; phone?: string }
): Promise<void> {
  const sb = getSupabase();

  if (sb) {
    await sb
      .from("chat_sessions")
      .update({
        user_name: data.name || null,
        user_email: data.email || null,
        user_phone: data.phone || null,
      })
      .eq("id", sessionId);
  } else {
    const store = loadLocalStore();
    const session = store.sessions.find((s) => s.id === sessionId);
    if (session) {
      if (data.name) session.user_name = data.name;
      if (data.email) session.user_email = data.email;
      if (data.phone) session.user_phone = data.phone;
    }
    saveLocalStore(store);
  }
}

export async function updateProductsDiscussed(
  sessionId: string,
  products: string[]
): Promise<void> {
  const sb = getSupabase();

  if (sb) {
    const { data: existing } = await sb
      .from("chat_sessions")
      .select("products_discussed")
      .eq("id", sessionId)
      .single();

    const merged = [...new Set([...(existing?.products_discussed || []), ...products])];
    await sb.from("chat_sessions").update({ products_discussed: merged }).eq("id", sessionId);
  } else {
    const store = loadLocalStore();
    const session = store.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.products_discussed = [...new Set([...session.products_discussed, ...products])];
    }
    saveLocalStore(store);
  }
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const sb = getSupabase();

  if (sb) {
    const { data } = await sb.from("chat_sessions").select("*").eq("id", sessionId).single();
    return data;
  } else {
    const store = loadLocalStore();
    return store.sessions.find((s) => s.id === sessionId) || null;
  }
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const sb = getSupabase();

  if (sb) {
    const { data } = await sb
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    return data || [];
  } else {
    const store = loadLocalStore();
    return store.messages.filter((m) => m.session_id === sessionId);
  }
}

export async function getAllSessions(limit = 50): Promise<ChatSession[]> {
  const sb = getSupabase();

  if (sb) {
    const { data } = await sb
      .from("chat_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return data || [];
  } else {
    const store = loadLocalStore();
    return store.sessions.slice(-limit).reverse();
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sb = getSupabase();

  if (sb) {
    await sb.from("chat_messages").delete().eq("session_id", sessionId);
    await sb.from("chat_sessions").delete().eq("id", sessionId);
  } else {
    const store = loadLocalStore();
    store.sessions = store.sessions.filter((s) => s.id !== sessionId);
    store.messages = store.messages.filter((m) => m.session_id !== sessionId);
    saveLocalStore(store);
  }
}

export async function getAnalytics(): Promise<{
  totalSessions: number;
  totalMessages: number;
  topProducts: { product: string; count: number }[];
  sessionsByCountry: { country: string; count: number }[];
  recentSessions: ChatSession[];
}> {
  const sb = getSupabase();

  if (sb) {
    const { count: totalSessions } = await sb.from("chat_sessions").select("id", { count: "exact" });
    const { count: totalMessages } = await sb.from("chat_messages").select("id", { count: "exact" });
    const { data: sessions } = await sb.from("chat_sessions").select("*").order("created_at", { ascending: false }).limit(20);

    const productCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();

    for (const s of sessions || []) {
      for (const p of s.products_discussed || []) {
        productCounts.set(p, (productCounts.get(p) || 0) + 1);
      }
      const c = s.user_country || "Unknown";
      countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
    }

    return {
      totalSessions: totalSessions || 0,
      totalMessages: totalMessages || 0,
      topProducts: [...productCounts.entries()].map(([product, count]) => ({ product, count })).sort((a, b) => b.count - a.count),
      sessionsByCountry: [...countryCounts.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count),
      recentSessions: sessions || [],
    };
  } else {
    const store = loadLocalStore();
    const productCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();

    for (const s of store.sessions) {
      for (const p of s.products_discussed || []) {
        productCounts.set(p, (productCounts.get(p) || 0) + 1);
      }
      const c = s.user_country || "Unknown";
      countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
    }

    return {
      totalSessions: store.sessions.length,
      totalMessages: store.messages.length,
      topProducts: [...productCounts.entries()].map(([product, count]) => ({ product, count })).sort((a, b) => b.count - a.count),
      sessionsByCountry: [...countryCounts.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count),
      recentSessions: store.sessions.slice(-20).reverse(),
    };
  }
}
