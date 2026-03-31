"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback } from "react";
import {
  Send,
  Volume2,
  VolumeX,
  Guitar,
  HelpCircle,
  RotateCcw,
  Sliders,
  Headphones,
  Shield,
  X,
  Mic,
  MicOff,
  Mail,
  Maximize2,
  Phone,
} from "lucide-react";
import { ChatMessage, TypingIndicator } from "./chat-message";
import { speakText, stopSpeaking, initVoices, isTTSSupported } from "@/lib/tts";
import { VoiceCall } from "./voice-call";

const SUGGESTED_QUESTIONS = [
  { icon: <Guitar size={14} />, text: "How do I connect my speaker cabinet to the 6505?" },
  { icon: <Volume2 size={14} />, text: "How do I pair Bluetooth on my PV14 mixer?" },
  { icon: <Sliders size={14} />, text: "What settings for a heavy metal guitar tone?" },
  { icon: <HelpCircle size={14} />, text: "What does the Mid-Morph knob do?" },
];

const EMAIL_TRIGGER_KEYWORDS = /\b(price|buy|purchase|order|dealer|store|cost|how much|where to get)\b/i;
const EMAIL_TRIGGER_MESSAGE_COUNT = 3;

function generateSessionId() {
  return "sess_" + crypto.randomUUID().replace(/-/g, "").substring(0, 16);
}

export function Chat() {
  // Session — initialize after mount to avoid hydration mismatch
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "ssr-placeholder";
    const existing = localStorage.getItem("peavey-session-id");
    if (existing) return existing;
    const id = generateSessionId();
    localStorage.setItem("peavey-session-id", id);
    return id;
  });

  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat", body: { sessionId } }));

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  // State
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showConsent, setShowConsent] = useState(false);

  // Check consent after mount to avoid hydration mismatch
  useEffect(() => {
    if (!localStorage.getItem("peavey-consent")) {
      setShowConsent(true);
    }
  }, []);
  const [showHumanHandoff, setShowHumanHandoff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [pageContext, setPageContext] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const lastSpokenRef = useRef<number>(0);

  const isLoading = status === "streaming" || status === "submitted";
  const userMessageCount = messages.filter((m) => m.role === "user").length;

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    if (messages.length > 0) setShowWelcome(false);
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Initialize TTS voices on mount
  useEffect(() => {
    if (isTTSSupported()) initVoices();
  }, []);

  // Auto-speak new assistant messages when enabled
  useEffect(() => {
    if (!autoSpeak || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant" && !isLoading && messages.length > lastSpokenRef.current) {
      const text = lastMsg.parts
        ?.filter((p) => p.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join("");
      if (text) {
        speakText(text);
        lastSpokenRef.current = messages.length;
      }
    }
  }, [messages, isLoading, autoSpeak]);

  // Page-aware context: listen for postMessage from widget.js
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "peavey-context" && e.data?.url) {
        // Extract product from URL: /product/6505-1992-original → "6505 1992 original"
        const match = e.data.url.match(/\/product\/([^/]+)/);
        if (match) {
          setPageContext(match[1].replace(/-/g, " "));
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Email capture trigger
  useEffect(() => {
    if (emailCaptured || showEmailCapture) return;
    if (userMessageCount >= EMAIL_TRIGGER_MESSAGE_COUNT) {
      setShowEmailCapture(true);
      return;
    }
    // Check for purchase-intent keywords
    const lastUserMsg = messages.filter((m) => m.role === "user").pop();
    if (lastUserMsg) {
      const text = lastUserMsg.parts
        ?.filter((p) => p.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join("");
      if (text && EMAIL_TRIGGER_KEYWORDS.test(text)) {
        setShowEmailCapture(true);
      }
    }
  }, [messages, userMessageCount, emailCaptured, showEmailCapture]);

  // Handlers
  const handleConsent = () => { localStorage.setItem("peavey-consent", "true"); setShowConsent(false); };

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }, [input, isLoading, sendMessage]);

  const handleSuggestionClick = (question: string) => { sendMessage({ text: question }); };

  const handleFollowUp = (question: string) => { sendMessage({ text: question }); };

  const handleButtonClick = (action: string) => { sendMessage({ text: action }); };

  const handleVoiceCallSend = useCallback((text: string) => {
    sendMessage({ text });
  }, [sendMessage]);

  // Get the last bot message text for the voice call to speak
  const lastBotMessage = (() => {
    const botMessages = messages.filter((m) => m.role === "assistant");
    const last = botMessages[botMessages.length - 1];
    if (!last) return null;
    return (
      last.parts
        ?.filter((p) => p.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join("") || null
    );
  })();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleReset = () => {
    setMessages([]);
    setShowWelcome(true);
    setShowEmailCapture(false);
    localStorage.removeItem("peavey-session-id");
  };

  // Voice input
  const handleVoiceInput = () => {
    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: { results: { 0: { 0: { transcript: string } } } }) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " : "") + transcript);
      setIsRecording(false);
      inputRef.current?.focus();
    };

    recognition.onerror = () => { setIsRecording(false); };
    recognition.onend = () => { setIsRecording(false); };

    recognition.start();
    setIsRecording(true);
  };

  // Email capture submit
  const handleEmailSubmit = async () => {
    if (!emailInput.trim() || !emailInput.includes("@")) return;
    setEmailCaptured(true);
    setShowEmailCapture(false);
    try {
      await fetch("/api/chat/sync-hubspot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email: emailInput }),
      });
    } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-background" role="application" aria-label="PeaveyPro Chat">
      {/* Voice Call Overlay */}
      {showVoiceCall && (
        <VoiceCall
          onClose={() => setShowVoiceCall(false)}
          onSendMessage={handleVoiceCallSend}
          lastBotMessage={lastBotMessage}
          isLoading={isLoading}
        />
      )}

      {/* Privacy consent */}
      {showConsent && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2.5" role="alert">
          <div className="flex items-start gap-2">
            <Shield size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This chat is powered by AI. Conversations may be stored to improve our support.{" "}
                <a href="https://peavey.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-amber-700">Privacy Policy</a>
              </p>
            </div>
            <button onClick={handleConsent} className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-[10px] font-semibold text-amber-700 transition-colors" aria-label="Accept privacy policy">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 border-b border-border bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://peavey.com/wp-content/uploads/2023/08/pv-logo-white-1.svg" alt="Peavey" className="h-4 w-auto invert" />
            <div className="w-px h-6 bg-white/10" />
            <div>
              <h1 className="text-xs font-semibold text-foreground">PeaveyPro</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] text-green-400/70">Online</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setAutoSpeak(!autoSpeak); if (autoSpeak) stopSpeaking(); }}
              className={`transition-colors p-1.5 rounded-lg ${
                autoSpeak
                  ? "text-accent bg-accent/10 hover:bg-accent/20"
                  : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
              title={autoSpeak ? "Auto-speak ON — click to disable" : "Auto-speak OFF — click to enable"}
              aria-label={autoSpeak ? "Disable auto-speak" : "Enable auto-speak"}
            >
              {autoSpeak ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button onClick={() => setShowHumanHandoff(true)} className="text-muted hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-card-hover" title="Talk to a human" aria-label="Talk to a human">
              <Headphones size={15} />
            </button>
            {messages.length > 0 && (
              <button onClick={handleReset} className="text-muted hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-card-hover" title="New conversation" aria-label="Start new conversation">
                <RotateCcw size={15} />
              </button>
            )}
            <button
              onClick={() => setShowVoiceCall(true)}
              className="text-muted hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-card-hover"
              title="Start voice call"
              aria-label="Start voice call with PeaveyPro"
            >
              <Phone size={15} />
            </button>
            <button
              onClick={() => window.open("/chat", "_blank")}
              className="text-muted hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-card-hover"
              title="Open full screen"
              aria-label="Open chat in full screen"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Human handoff modal */}
      {showHumanHandoff && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Contact support">
          <div className="bg-white border border-border rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Headphones size={18} className="text-accent-gold" />
                <h3 className="text-sm font-bold text-foreground">Talk to a Human</h3>
              </div>
              <button onClick={() => setShowHumanHandoff(false)} className="text-muted hover:text-foreground" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted mb-4 leading-relaxed">Need to speak with a real person?</p>
            <div className="space-y-2.5">
              <a href="tel:+16014835365" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border hover:bg-card-hover transition-colors">
                <span className="text-lg">📞</span>
                <div>
                  <div className="text-xs font-semibold text-foreground">(601) 483-5365</div>
                  <div className="text-[10px] text-muted">Call Peavey Support</div>
                </div>
              </a>
              <a href="https://peavey.com/support" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border hover:bg-card-hover transition-colors">
                <span className="text-lg">🌐</span>
                <div>
                  <div className="text-xs font-semibold text-foreground">peavey.com/support</div>
                  <div className="text-[10px] text-muted">Submit a support ticket</div>
                </div>
              </a>
              <a href="mailto:support@peavey.com" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border hover:bg-card-hover transition-colors">
                <span className="text-lg">✉️</span>
                <div>
                  <div className="text-xs font-semibold text-foreground">support@peavey.com</div>
                  <div className="text-[10px] text-muted">Email Peavey Support</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
        {/* Page-aware greeting */}
        {showWelcome && pageContext && (
          <div className="message-enter bg-gradient-to-r from-accent/5 to-transparent border border-accent/10 rounded-xl px-4 py-3 mb-3">
            <p className="text-xs text-foreground/70">
              👋 I see you&apos;re looking at the <strong className="text-foreground">{pageContext}</strong>. Ask me anything about it!
            </p>
          </div>
        )}

        {showWelcome && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 rounded-2xl bg-gray-900 border border-gray-200 flex items-center justify-center mb-5 shadow-lg">
              <img src="https://peavey.com/wp-content/uploads/2023/08/pv-logo-white-1.svg" alt="Peavey" className="h-5 w-auto brightness-0 invert" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">How can we help?</h2>
            <p className="text-xs text-muted mb-6 max-w-[280px] leading-relaxed">
              Get instant answers about your Peavey gear — setup, specs, troubleshooting, and tone recommendations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md" role="group" aria-label="Suggested questions">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => handleSuggestionClick(q.text)} disabled={isLoading} tabIndex={0}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-card-hover hover:border-accent/30 transition-all text-left text-xs text-muted hover:text-foreground group disabled:opacity-50">
                  <span className="text-accent group-hover:text-accent-gold transition-colors">{q.icon}</span>
                  <span className="line-clamp-2">{q.text}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted/40 mt-6">Powered by PeaveyPro &bull; Not a substitute for professional service</p>
          </div>
        )}

        {messages.map((message, index) => {
          let textContent = message.parts
            ?.filter((p) => p.type === "text")
            .map((p) => ("text" in p ? p.text : ""))
            .join("");
          if (!textContent) return null;

          // Strip any leaked AI reasoning/thinking from assistant messages
          if (message.role === "assistant") {
            textContent = textContent
              .replace(/^(It looks like|Let me |I('ll| will| need to| should)|My (initial |previous )?search|The previous search|To (fulfill|address|find)|Since (browseCatalog|searchManuals)|This (means|indicates|is a good)|I will (try|continue|start|also)|Let's try)[^\n]*\n*/gm, "")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
          }
          if (!textContent) return null;
          return (
            <ChatMessage
              key={message.id}
              role={message.role as "user" | "assistant"}
              content={textContent}
              messageIndex={index}
              sessionId={sessionId}
              onFollowUp={handleFollowUp}
              onButtonClick={handleButtonClick}
            />
          );
        })}

        {isLoading && <TypingIndicator />}

        {/* Email capture card */}
        {showEmailCapture && !emailCaptured && (
          <div className="message-enter bg-gradient-to-br from-accent/5 to-accent-gold/5 border border-accent/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={14} className="text-accent-gold" />
              <span className="text-xs font-semibold text-foreground">Want setup tips emailed to you?</span>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
                aria-label="Email address"
              />
              <button onClick={handleEmailSubmit} className="px-3 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-xs font-semibold text-accent hover:bg-accent/30 transition-colors">
                Send
              </button>
              <button onClick={() => setShowEmailCapture(false)} className="px-2 py-1.5 text-xs text-muted hover:text-foreground transition-colors" aria-label="Dismiss">
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-card p-3">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-end gap-2">
          {/* Voice input button */}
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isRecording
                ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                : "bg-white/[0.03] border border-border text-muted hover:text-foreground hover:bg-white/[0.06]"
            }`}
            title={isRecording ? "Stop recording" : "Voice input"}
            aria-label={isRecording ? "Stop voice recording" : "Start voice input"}
          >
            {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Listening..." : "Ask about your Peavey gear..."}
              rows={1}
              disabled={status !== "ready"}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all disabled:opacity-50"
              style={{ maxHeight: "120px" }}
              aria-label="Type your message"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shadow-lg shadow-red-900/20 disabled:shadow-none"
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
