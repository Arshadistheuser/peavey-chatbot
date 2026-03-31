"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  MessageSquare,
  Globe,
  Package,
  Users,
  Clock,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";

interface Analytics {
  totalSessions: number;
  totalMessages: number;
  topProducts: { product: string; count: number }[];
  sessionsByCountry: { country: string; count: number }[];
  recentSessions: Array<{
    id: string;
    created_at: string;
    user_country: string;
    user_city: string;
    user_email: string | null;
    message_count: number;
    products_discussed: string[];
    hubspot_contact_id: string | null;
  }>;
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<
    Record<string, Array<{ role: string; content: string; created_at: string }>>
  >({});

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics");
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
    setLoading(false);
  };

  const fetchSessionMessages = async (sessionId: string) => {
    if (sessionMessages[sessionId]) {
      setExpandedSession(expandedSession === sessionId ? null : sessionId);
      return;
    }
    try {
      const res = await fetch("/api/admin/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "session_messages", sessionId }),
      });
      const data = await res.json();
      setSessionMessages((prev) => ({ ...prev, [sessionId]: data.messages }));
      setExpandedSession(sessionId);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-red-500" />
            <h1 className="text-lg font-bold">Peavey Chatbot Admin</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              Dashboard
            </span>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-colors"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<MessageSquare size={18} />}
            label="Total Sessions"
            value={analytics?.totalSessions || 0}
          />
          <StatCard
            icon={<BarChart3 size={18} />}
            label="Total Messages"
            value={analytics?.totalMessages || 0}
          />
          <StatCard
            icon={<Globe size={18} />}
            label="Countries"
            value={analytics?.sessionsByCountry.length || 0}
          />
          <StatCard
            icon={<Users size={18} />}
            label="Emails Captured"
            value={
              analytics?.recentSessions.filter((s) => s.user_email).length || 0
            }
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Top products */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package size={14} />
              Top Products Discussed
            </h2>
            {analytics?.topProducts.length ? (
              <div className="space-y-2">
                {analytics.topProducts.map((p) => (
                  <div key={p.product} className="flex items-center justify-between">
                    <span className="text-sm text-white/80">{p.product}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                      {p.count} mentions
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/30">No data yet</p>
            )}
          </div>

          {/* Countries */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Globe size={14} />
              Sessions by Country
            </h2>
            {analytics?.sessionsByCountry.length ? (
              <div className="space-y-2">
                {analytics.sessionsByCountry.map((c) => (
                  <div key={c.country} className="flex items-center justify-between">
                    <span className="text-sm text-white/80">{c.country}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                      {c.count} sessions
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/30">No data yet</p>
            )}
          </div>
        </div>

        {/* Recent sessions */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock size={14} />
            Recent Chat Sessions
          </h2>
          {analytics?.recentSessions.length ? (
            <div className="space-y-1">
              {analytics.recentSessions.map((session) => (
                <div key={session.id}>
                  <button
                    onClick={() => fetchSessionMessages(session.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                  >
                    {expandedSession === session.id ? (
                      <ChevronDown size={14} className="text-white/30 shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-white/30 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">
                          {new Date(session.created_at).toLocaleString()}
                        </span>
                        <span className="text-xs text-white/20">•</span>
                        <span className="text-xs text-white/40">
                          {session.user_country}/{session.user_city}
                        </span>
                        <span className="text-xs text-white/20">•</span>
                        <span className="text-xs text-white/40">
                          {session.message_count} msgs
                        </span>
                        {session.user_email && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                            {session.user_email}
                          </span>
                        )}
                        {session.hubspot_contact_id && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
                            HubSpot
                          </span>
                        )}
                      </div>
                      {session.products_discussed?.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {session.products_discussed.map((p) => (
                            <span
                              key={p}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/70"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded messages */}
                  {expandedSession === session.id && sessionMessages[session.id] && (
                    <div className="ml-8 mb-3 pl-3 border-l border-white/[0.06] space-y-2">
                      {sessionMessages[session.id].map((msg, i) => (
                        <div key={i} className="text-xs">
                          <span
                            className={`font-semibold ${
                              msg.role === "user" ? "text-blue-400" : "text-red-400"
                            }`}
                          >
                            {msg.role === "user" ? "Customer" : "Bot"}:
                          </span>{" "}
                          <span className="text-white/60">
                            {msg.content.length > 200
                              ? msg.content.substring(0, 200) + "..."
                              : msg.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/30">No sessions yet. Start chatting to see data here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 text-white/40 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
