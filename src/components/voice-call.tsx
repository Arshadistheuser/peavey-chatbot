"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { PhoneOff, MicOff, Mic, X, Hand } from "lucide-react";
import { stripMarkdownForSpeech, chunkText, selectBestVoice, initVoices } from "@/lib/tts";

type CallState = "starting" | "listening" | "processing" | "speaking" | "error";

interface VoiceCallProps {
  onClose: () => void;
  onSendMessage: (text: string) => void;
  lastBotMessage: string | null;
  isLoading: boolean;
}

interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
}

export function VoiceCall({ onClose, onSendMessage, lastBotMessage, isLoading }: VoiceCallProps) {
  const [callState, setCallState] = useState<CallState>("starting");
  const [liveText, setLiveText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const waitingRef = useRef(false);
  const wasLoadingRef = useRef(false);
  const pendingUserTextRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedTextRef = useRef("");
  const activeRef = useRef(true); // is the call still active?

  // Refs that always hold latest state (for use inside callbacks set once)
  const isMutedRef = useRef(false);
  const callStateRef = useRef<CallState>("starting");

  // Keep refs in sync
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // Portal mount
  useEffect(() => { setMounted(true); }, []);

  // Scroll transcript
  useEffect(() => {
    scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight);
  }, [transcript, liveText]);

  // --- Core: detect bot response and speak it ---
  // Use a debounced check: when isLoading becomes false, wait 500ms
  // to make sure it stays false (not a brief gap between tool calls)
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log("[vc] isLoading:", isLoading, "waiting:", waitingRef.current, "botMsg:", lastBotMessage?.length);

    if (isLoading) {
      // Clear any pending response timer — AI is still working
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
        responseTimerRef.current = null;
      }
      wasLoadingRef.current = true;
      return;
    }

    // isLoading is false — but only act if we were loading AND waiting for a response
    if (wasLoadingRef.current && waitingRef.current && lastBotMessage) {
      // Debounce: wait 500ms to confirm loading is truly done
      if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
      responseTimerRef.current = setTimeout(() => {
        // Double-check we're still not loading
        if (waitingRef.current && lastBotMessage) {
          console.log("[vc] Bot response confirmed, speaking. Length:", lastBotMessage.length);
          waitingRef.current = false;
          wasLoadingRef.current = false;

          if (pendingUserTextRef.current) {
            const ut = pendingUserTextRef.current;
            pendingUserTextRef.current = "";
            setTranscript(p => [...p, { role: "user", text: ut }]);
          }
          setTranscript(p => [...p, { role: "assistant", text: lastBotMessage }]);
          setLiveText("");
          doSpeak(lastBotMessage);
        }
      }, 300);
    }
  }, [isLoading, lastBotMessage]);

  // Track if bot was interrupted so we don't resume listening after cancelled speech
  const interruptedRef = useRef(false);

  // --- Speak and then resume listening ---
  function doSpeak(text: string) {
    if (!activeRef.current) return;
    setCallState("speaking");
    interruptedRef.current = false;

    // Stop recognition while bot speaks to avoid picking up bot's own voice
    try { recognitionRef.current?.stop(); } catch {}

    const cleaned = stripMarkdownForSpeech(text);
    if (!cleaned) { doListen(); return; }

    const chunks = chunkText(cleaned, 350);
    const voice = selectBestVoice();
    let idx = 0;

    function next() {
      if (!activeRef.current || interruptedRef.current) return;
      if (idx >= chunks.length) {
        console.log("[vc] Done speaking all chunks");
        doListen();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[idx]);
      if (voice) u.voice = voice;
      u.rate = 1.0;
      u.lang = "en-US";
      u.onend = () => { idx++; next(); };
      u.onerror = () => { idx++; next(); };
      window.speechSynthesis.speak(u);
    }
    next();
  }

  // --- Start / restart listening ---
  function doListen() {
    if (!activeRef.current) return;
    console.log("[vc] Resuming listening");
    setCallState("listening");
    accumulatedTextRef.current = "";
    setLiveText("");

    const r = recognitionRef.current;
    if (!r) return;
    try { r.stop(); } catch {}

    setTimeout(() => {
      if (!activeRef.current) return;
      try {
        r.start();
        console.log("[vc] Recognition restarted");
      } catch (e) {
        console.warn("[vc] Restart failed, retrying:", e);
        setTimeout(() => {
          if (!activeRef.current) return;
          try { r.start(); } catch {}
        }, 500);
      }
    }, 300);
  }

  // --- Handle silence (user done talking) ---
  const doSend = useCallback(() => {
    const text = accumulatedTextRef.current.trim();
    if (!text || !activeRef.current) return;

    console.log("[vc] Sending:", text);
    setCallState("processing");
    pendingUserTextRef.current = text;
    waitingRef.current = true;
    accumulatedTextRef.current = "";
    setLiveText("");
    try { recognitionRef.current?.stop(); } catch {}
    onSendMessage(text);
  }, [onSendMessage]);

  // Keep doSend ref fresh for the timeout callback
  const doSendRef = useRef(doSend);
  useEffect(() => { doSendRef.current = doSend; }, [doSend]);

  // --- Initialize on mount ---
  useEffect(() => {
    console.log("[vc] Mount");
    activeRef.current = true;

    const SR =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SR || !window.speechSynthesis) {
      setCallState("error");
      setErrorMsg("Voice calls require Chrome or Edge.");
      return;
    }

    initVoices();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // Ignore input while muted, processing, or bot is speaking
      if (isMutedRef.current || callStateRef.current === "processing" || callStateRef.current === "speaking") return;

      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      text = text.trim();
      if (!text) return;

      console.log("[vc] Heard:", text);
      accumulatedTextRef.current = text;
      setLiveText(text);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => doSendRef.current(), 1200);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      console.log("[vc] Error:", e.error);
      if (e.error === "not-allowed") {
        setCallState("error");
        setErrorMsg("Microphone blocked. Click the mic icon in the address bar to allow access, then try again.");
        return;
      }
      // Restart on transient errors
      if (activeRef.current && callStateRef.current === "listening") {
        setTimeout(() => { try { rec.start(); } catch {} }, 500);
      }
    };

    rec.onend = () => {
      console.log("[vc] onend, state:", callStateRef.current);
      if (activeRef.current && callStateRef.current === "listening") {
        setTimeout(() => {
          if (activeRef.current && callStateRef.current === "listening") {
            try { rec.start(); } catch {}
          }
        }, 300);
      }
    };

    recognitionRef.current = rec;

    // Start
    try {
      rec.start();
      setCallState("listening");
      console.log("[vc] Started");
    } catch {
      setCallState("error");
      setErrorMsg("Could not access microphone.");
    }

    // Timer
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);

    return () => {
      console.log("[vc] Unmount");
      activeRef.current = false;
      try { rec.stop(); } catch {}
      window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInterrupt = () => {
    console.log("[vc] User interrupted via button");
    interruptedRef.current = true;
    window.speechSynthesis.cancel();
    doListen();
  };

  const endCall = () => {
    activeRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    window.speechSynthesis.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    onClose();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const stateColor =
    callState === "listening" ? "text-green-400"
    : callState === "speaking" ? "text-red-400"
    : callState === "processing" ? "text-amber-400"
    : "text-white/50";

  const stateLabel =
    callState === "listening" ? "Listening..."
    : callState === "speaking" ? "Speaking..."
    : callState === "processing" ? "Thinking..."
    : callState === "starting" ? "Starting..."
    : "Error";

  // --- Render via portal to escape widget container ---
  const content = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", flexDirection: "column",
        background: "linear-gradient(to bottom, #111827, #000000)", width: "100vw", height: "100vh" }}
      role="dialog" aria-modal="true" aria-label="Voice call with PeaveyPro"
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>PeaveyPro Voice</span>
        </div>
        <button onClick={endCall} style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer", padding: 8 }} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {/* Center content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "0 24px", overflow: "hidden" }}>
        {/* Avatar with glow */}
        <div style={{ position: "relative", width: 96, height: 96 }}>
          <div style={{
            position: "absolute", inset: -20, borderRadius: "50%", transition: "all 0.5s",
            background: callState === "listening" ? "rgba(34,197,94,0.15)"
              : callState === "speaking" ? "rgba(239,68,68,0.15)"
              : callState === "processing" ? "rgba(245,158,11,0.15)"
              : "transparent",
            animation: callState !== "error" && callState !== "starting" ? "pulse 2s infinite" : "none",
          }} />
          <div style={{
            width: 96, height: 96, borderRadius: "50%", background: "#1f2937",
            border: "2px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          }}>
            <img src="https://peavey.com/wp-content/uploads/2023/08/pv-logo-white-1.svg" alt="" style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }} />
          </div>
        </div>

        {/* Status */}
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "white", margin: "0 0 4px" }}>PeaveyPro</h2>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }} className={stateColor}>{stateLabel}</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{fmt(elapsed)}</p>
        </div>

        {/* Error */}
        {callState === "error" && (
          <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "12px 16px", maxWidth: 360 }}>
            <p style={{ fontSize: 14, color: "#fca5a5", margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        {/* Live text */}
        {liveText && (
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 16px", maxWidth: 400, width: "100%" }}>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontStyle: "italic", margin: 0 }}>&ldquo;{liveText}&rdquo;</p>
          </div>
        )}

        {/* Transcript */}
        {transcript.length > 0 && (
          <div ref={scrollRef} style={{ flex: 1, width: "100%", maxWidth: 512, overflowY: "auto", maxHeight: "40vh", display: "flex", flexDirection: "column", gap: 12 }}>
            {transcript.map((entry, i) => (
              <div key={i} style={{ display: "flex", justifyContent: entry.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", borderRadius: 16, padding: "10px 16px", fontSize: 14,
                  background: entry.role === "user" ? "rgba(255,255,255,0.1)" : "rgba(127,29,29,0.3)",
                  color: "rgba(255,255,255,0.9)",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 500, opacity: 0.5, margin: "0 0 4px" }}>{entry.role === "user" ? "You" : "PeaveyPro"}</p>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{entry.text.length > 300 ? entry.text.substring(0, 300) + "..." : entry.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ flexShrink: 0, padding: "16px 24px 32px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24 }}>
          {callState === "speaking" ? (
            <button onClick={handleInterrupt}
              style={{
                width: 56, height: 56, borderRadius: "50%", border: "1px solid rgba(239,68,68,0.5)",
                background: "rgba(239,68,68,0.2)",
                color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                animation: "pulse 1.5s infinite",
              }}
              aria-label="Interrupt and speak"
              title="Tap to interrupt"
            >
              <Hand size={22} />
            </button>
          ) : (
            <button onClick={() => setIsMuted(m => !m)}
              style={{
                width: 56, height: 56, borderRadius: "50%", border: isMuted ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.2)",
                background: isMuted ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.1)",
                color: isMuted ? "#f59e0b" : "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
          )}
          <button onClick={endCall}
            style={{
              width: 64, height: 64, borderRadius: "50%", background: "#dc2626", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 10px 30px rgba(127,29,29,0.5)",
            }}
            aria-label="End call"
          >
            <PhoneOff size={26} color="white" />
          </button>
          <div style={{ width: 56, height: 56 }} />
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 16 }}>Speak naturally — PeaveyPro is listening</p>
      </div>
    </div>
  );

  // Use portal to render directly on document.body, escaping any parent overflow/clipping
  if (!mounted) return null;
  return createPortal(content, document.body);
}
