"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Copy, Check, AlertTriangle, Info, ExternalLink, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Volume2, VolumeX } from "lucide-react";
import { speakText, stopSpeaking, isTTSSupported } from "@/lib/tts";
import { useState } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  messageIndex?: number;
  sessionId?: string;
  onFollowUp?: (question: string) => void;
  onButtonClick?: (action: string) => void;
}

// ===== Utility: Parse special tags from AI response =====

function parseSpecialTags(content: string) {
  // Extract follow-up questions
  const followUps: string[] = [];
  const followUpRegex = /\[FOLLOW_UP:\s*(.+?)\]/g;
  let match;
  while ((match = followUpRegex.exec(content)) !== null) {
    followUps.push(match[1].trim());
  }

  // Extract action buttons
  const buttons: string[] = [];
  const buttonRegex = /\[BUTTON:\s*(.+?)\]/g;
  while ((match = buttonRegex.exec(content)) !== null) {
    buttons.push(match[1].trim());
  }

  // Clean content — remove the tags
  const cleanContent = content
    .replace(/\[FOLLOW_UP:\s*.+?\]/g, "")
    .replace(/\[BUTTON:\s*.+?\]/g, "")
    .trim();

  return { cleanContent, followUps, buttons };
}

// ===== Sub-components =====

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-muted hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
      title="Copy code"
      aria-label="Copy code to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function SpeakButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);

  if (typeof window === "undefined" || !isTTSSupported()) return null;

  const handleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      const cancel = speakText(text);
      setSpeaking(true);
      // Listen for speech end to reset state
      const checkDone = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          setSpeaking(false);
          clearInterval(checkDone);
        }
      }, 500);
      // Store cancel in case component unmounts
      return () => { cancel(); clearInterval(checkDone); };
    }
  };

  return (
    <button
      onClick={handleSpeak}
      className={`p-1 rounded-md transition-all ${
        speaking
          ? "text-accent bg-accent/10"
          : "text-muted/40 hover:text-accent hover:bg-accent/10"
      }`}
      aria-label={speaking ? "Stop speaking" : "Read aloud"}
      title={speaking ? "Stop speaking" : "Read aloud"}
    >
      {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
    </button>
  );
}

function FeedbackButtons({ sessionId, messageIndex }: { sessionId?: string; messageIndex?: number }) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleFeedback = async (rating: "up" | "down") => {
    if (feedback) return; // Already rated
    setFeedback(rating);
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messageIndex, rating }),
      });
    } catch {}
  };

  return (
    <div className="flex items-center gap-1 mt-2" role="group" aria-label="Rate this response">
      <button
        onClick={() => handleFeedback("up")}
        disabled={feedback !== null}
        className={`p-1 rounded-md transition-all ${
          feedback === "up"
            ? "text-green-400 bg-green-400/10"
            : feedback === "down"
            ? "text-muted/20 cursor-not-allowed"
            : "text-muted/40 hover:text-green-400 hover:bg-green-400/10"
        }`}
        aria-label="Helpful"
        title="Helpful"
      >
        <ThumbsUp size={12} />
      </button>
      <button
        onClick={() => handleFeedback("down")}
        disabled={feedback !== null}
        className={`p-1 rounded-md transition-all ${
          feedback === "down"
            ? "text-red-400 bg-red-400/10"
            : feedback === "up"
            ? "text-muted/20 cursor-not-allowed"
            : "text-muted/40 hover:text-red-400 hover:bg-red-400/10"
        }`}
        aria-label="Not helpful"
        title="Not helpful"
      >
        <ThumbsDown size={12} />
      </button>
      {feedback && (
        <span className="text-[10px] text-muted/40 ml-1">
          {feedback === "up" ? "Thanks!" : "We'll improve"}
        </span>
      )}
    </div>
  );
}

// ===== Markdown Components =====

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-foreground mt-4 mb-2 pb-1.5 border-b border-border/50">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[15px] font-bold text-foreground mt-4 mb-2 flex items-center gap-2">
      <div className="w-1 h-4 rounded-full bg-accent" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-accent-gold mt-3 mb-1.5">{children}</h3>
  ),
  p: ({ children, node }) => {
    // If this paragraph contains an image, render as div to avoid block-in-inline issues
    const hasImage = node?.children?.some(
      (child: { type?: string; tagName?: string }) => child.type === "element" && child.tagName === "img"
    );
    if (hasImage) {
      return <div className="text-sm leading-[1.7] text-foreground/90 mb-2.5 max-w-full overflow-hidden">{children}</div>;
    }
    return <p className="text-sm leading-[1.7] text-foreground/90 mb-2.5">{children}</p>;
  },
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-foreground/70 not-italic text-[13px]">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-2 mb-3 ml-1">{children}</ol>
  ),
  li: ({ children, ...props }) => {
    const isOrdered = (props as Record<string, unknown>).ordered;
    return (
      <li className="flex gap-2 text-sm leading-[1.7] text-foreground/90">
        {isOrdered ? (
          <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-[11px] font-bold flex items-center justify-center mt-0.5">
            {(props as Record<string, unknown>).index !== undefined
              ? String(Number((props as Record<string, unknown>).index) + 1)
              : "•"}
          </span>
        ) : (
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent-gold mt-2" />
        )}
        <span className="flex-1">{children}</span>
      </li>
    );
  },
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      const lang = className?.replace("language-", "") || "";
      const codeText = String(children).replace(/\n$/, "");
      return (
        <div className="group relative my-3 rounded-lg overflow-hidden border border-border/50">
          {lang && (
            <div className="px-3 py-1 bg-white/[0.03] border-b border-border/50 text-[10px] font-mono text-muted uppercase tracking-wider">
              {lang}
            </div>
          )}
          <pre className="p-3 overflow-x-auto bg-gray-900">
            <code className="text-[13px] font-mono leading-relaxed text-emerald-400">
              {codeText}
            </code>
          </pre>
          <CopyButton text={codeText} />
        </div>
      );
    }
    return (
      <code className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-border/30 text-[13px] font-mono text-amber-400/90">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => {
    const text = String(children);
    const isSafety =
      text.toLowerCase().includes("warning") ||
      text.toLowerCase().includes("caution") ||
      text.toLowerCase().includes("danger") ||
      text.toLowerCase().includes("never");
    return (
      <div
        className={`my-3 rounded-lg border-l-[3px] px-3.5 py-2.5 text-sm ${
          isSafety
            ? "border-amber-500 bg-amber-500/[0.06] text-amber-200/90"
            : "border-accent-gold/50 bg-white/[0.02] text-foreground/80"
        }`}
      >
        {isSafety && (
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold mb-1">
            <AlertTriangle size={12} />
            Safety Notice
          </div>
        )}
        {children}
      </div>
    );
  },
  table: ({ children }) => (
    <div className="my-3 rounded-lg border border-border/50 overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider border-b border-border/50">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-foreground/80 border-b border-border/20">
      {children}
    </td>
  ),
  hr: () => (
    <hr className="my-4 border-none h-px bg-gradient-to-r from-transparent via-border to-transparent" />
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-gold hover:text-amber-300 underline underline-offset-2 decoration-accent-gold/30 hover:decoration-accent-gold/60 transition-colors inline-flex items-center gap-1"
    >
      {children}
      <ExternalLink size={10} className="shrink-0" />
    </a>
  ),
  img: ({ src, alt }) => {
    const imgSrc = typeof src === "string" ? src : undefined;
    if (!imgSrc) return null;
    return (
      <span className="block my-3 rounded-lg overflow-hidden border border-border bg-gray-50 max-w-full w-full box-border">
        <img
          src={imgSrc}
          alt={alt || "Peavey product"}
          className="max-w-full w-full h-auto max-h-[240px] object-contain bg-white p-3 block box-border"
          loading="lazy"
          style={{ maxWidth: "100%", width: "100%", display: "block" }}
        />
        {alt && (
          <span className="block px-3 py-2 bg-gray-50 border-t border-border overflow-hidden">
            <span className="block text-[11px] text-muted/70 truncate">{alt}</span>
          </span>
        )}
      </span>
    );
  },
};

// ===== Main ChatMessage Component =====

const COLLAPSE_WORD_LIMIT = 300;
const COLLAPSE_PREVIEW_WORDS = 150;

export function ChatMessage({ role, content, messageIndex, sessionId, onFollowUp, onButtonClick }: ChatMessageProps) {
  const isUser = role === "user";
  const [expanded, setExpanded] = useState(false);

  // Parse special tags from assistant messages
  const { cleanContent, followUps, buttons } = isUser
    ? { cleanContent: content, followUps: [], buttons: [] }
    : parseSpecialTags(content);

  // Response collapsing
  const words = cleanContent.split(/\s+/);
  const isLong = !isUser && words.length > COLLAPSE_WORD_LIMIT;
  const displayContent = isLong && !expanded
    ? words.slice(0, COLLAPSE_PREVIEW_WORDS).join(" ") + "..."
    : cleanContent;

  const hasCitation =
    !isUser &&
    (cleanContent.includes("According to") ||
      cleanContent.includes("manual") ||
      cleanContent.includes("peavey.com"));

  return (
    <div className={`message-enter flex gap-3 ${isUser ? "flex-row-reverse" : ""} mb-1`} role="article" aria-label={isUser ? "Your message" : "Assistant response"}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1 ${
          isUser
            ? "bg-gradient-to-br from-red-600 to-red-700 text-white"
            : "bg-white border border-border shadow-sm"
        }`}
        aria-hidden="true"
      >
        {isUser ? (
          <User size={14} />
        ) : (
          <img
            src="https://peavey.com/wp-content/uploads/2023/08/pv-logo-white-1.svg"
            alt=""
            className="h-2.5 w-auto invert"
          />
        )}
      </div>

      {/* Message content */}
      <div className={`max-w-[calc(100%-44px)] min-w-0 overflow-hidden ${isUser ? "flex flex-col items-end" : ""}`}>
        <span className={`text-[10px] font-medium mb-1 block ${isUser ? "text-red-500/60" : "text-accent/60"}`}>
          {isUser ? "You" : "PeaveyPro"}
        </span>

        <div
          className={`rounded-2xl px-4 py-3 overflow-hidden break-words w-full ${
            isUser
              ? "bg-gradient-to-br from-red-600 to-red-700 border border-red-700 text-white rounded-tr-md"
              : "bg-card border border-border text-foreground rounded-tl-md"
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : (
            <>
              <div className="prose-peavey overflow-hidden">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {displayContent}
                </ReactMarkdown>
              </div>

              {/* Show more / less for long responses */}
              {isLong && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-[11px] text-accent-gold/70 hover:text-accent-gold mt-2 transition-colors"
                  aria-expanded={expanded}
                >
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {expanded ? "Show less" : `Show more (${words.length - COLLAPSE_PREVIEW_WORDS} more words)`}
                </button>
              )}

              {/* Action buttons */}
              {buttons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="Suggested actions">
                  {buttons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={() => onButtonClick?.(btn)}
                      className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent hover:bg-accent/20 hover:border-accent/40 transition-all"
                      tabIndex={0}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Follow-up suggestions */}
        {!isUser && followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Follow-up questions">
            {followUps.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp?.(q)}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-border/40 text-[11px] text-muted hover:text-foreground hover:bg-white/[0.06] hover:border-border/60 transition-all text-left leading-tight"
                tabIndex={0}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Feedback + citation row */}
        {!isUser && (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-0.5">
              <FeedbackButtons sessionId={sessionId} messageIndex={messageIndex} />
              <SpeakButton text={cleanContent} />
            </div>
            {hasCitation && (
              <div className="flex items-center gap-1 text-[10px] text-muted/40">
                <Info size={9} />
                <span>From Peavey docs</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="message-enter flex gap-3 mb-1" role="status" aria-label="Assistant is typing">
      <div className="shrink-0 w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center shadow-sm mt-1" aria-hidden="true">
        <img
          src="https://peavey.com/wp-content/uploads/2023/08/pv-logo-white-1.svg"
          alt=""
          className="h-2.5 w-auto invert"
        />
      </div>
      <div>
        <span className="text-[10px] font-medium text-accent/60 mb-1 block">PeaveyPro</span>
        <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1" aria-hidden="true">
              <div className="typing-dot w-1.5 h-1.5 bg-accent rounded-full" />
              <div className="typing-dot w-1.5 h-1.5 bg-accent rounded-full" />
              <div className="typing-dot w-1.5 h-1.5 bg-accent rounded-full" />
            </div>
            <span className="text-[11px] text-muted/50">Searching knowledge base...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
