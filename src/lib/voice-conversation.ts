/**
 * Voice Conversation Engine
 *
 * Creates a continuous voice conversation loop using the browser's
 * Web Speech API — like a phone call with the bot.
 *
 * Flow: Listen → User speaks → Silence detected → Send to AI →
 *       AI responds → Bot speaks response → Resume listening → repeat
 */

import { stripMarkdownForSpeech, chunkText, selectBestVoice, initVoices } from "./tts";

// Web Speech API types (not in all TS libs)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

export interface VoiceConversationCallbacks {
  onStateChange: (state: VoiceState) => void;
  onUserSpeaking: (text: string) => void;
  onUserDoneSpeaking: (text: string) => void;
  onError: (error: string) => void;
}

export class VoiceConversation {
  private recognition: SpeechRecognitionInstance | null = null;
  private state: VoiceState = "idle";
  private callbacks: VoiceConversationCallbacks;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isMuted = false;
  private shouldRestart = false;
  // Accumulate all speech since last send
  private accumulatedText = "";
  private lastSpeechTime = 0;

  // How long to wait after last speech before considering user done
  private silenceTimeout = 2000;

  constructor(callbacks: VoiceConversationCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<boolean> {
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      this.callbacks.onError("Voice conversation requires Chrome or Edge browser.");
      return false;
    }

    await initVoices();

    this.recognition = new (SpeechRecognitionAPI as new () => SpeechRecognitionInstance)();
    this.recognition.lang = "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      if (this.isMuted || this.state === "processing") return;

      console.log("[voice] onresult fired, results:", event.results.length);

      // If user speaks while bot is talking, interrupt the bot
      if (this.state === "speaking") {
        console.log("[voice] User interrupted bot — cancelling speech");
        window.speechSynthesis.cancel();
        this.setState("listening");
      }

      // Build full transcript from all results
      let fullText = "";
      let hasInterim = false;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        fullText += result[0].transcript;
        if (!result.isFinal) hasInterim = true;
      }

      fullText = fullText.trim();
      if (!fullText) return;

      console.log("[voice] Transcript:", fullText, "hasInterim:", hasInterim);

      this.accumulatedText = fullText;
      this.lastSpeechTime = Date.now();
      this.callbacks.onUserSpeaking(fullText);

      // Reset silence timer
      this.clearSilenceTimer();
      this.silenceTimer = setTimeout(() => {
        this.handleSilence();
      }, this.silenceTimeout);
    };

    this.recognition.onerror = (event) => {
      console.log("[voice] Recognition error:", event.error);

      if (event.error === "no-speech" || event.error === "aborted") {
        if (this.shouldRestart && this.state === "listening") {
          this.restartRecognition();
        }
        return;
      }

      if (event.error === "not-allowed") {
        this.callbacks.onError("Microphone access denied. Please allow microphone access and try again.");
        this.stop();
        return;
      }

      if (this.shouldRestart && this.state === "listening") {
        setTimeout(() => this.restartRecognition(), 500);
      }
    };

    this.recognition.onend = () => {
      console.log("[voice] Recognition ended, state:", this.state, "shouldRestart:", this.shouldRestart);
      if (this.shouldRestart && this.state === "listening") {
        this.restartRecognition();
      }
    };

    this.shouldRestart = true;
    this.setState("listening");

    try {
      this.recognition.start();
      console.log("[voice] Recognition started successfully");
    } catch (e) {
      console.error("[voice] Failed to start recognition:", e);
      this.callbacks.onError("Could not start voice recognition. Please check microphone permissions.");
      return false;
    }

    return true;
  }

  stop(): void {
    console.log("[voice] Stopping conversation");
    this.shouldRestart = false;
    this.clearSilenceTimer();
    window.speechSynthesis.cancel();

    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* already stopped */ }
      this.recognition = null;
    }

    this.accumulatedText = "";
    this.setState("idle");
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) this.clearSilenceTimer();
  }

  getState(): VoiceState {
    return this.state;
  }

  /**
   * Called when the AI response text is ready.
   * Speaks it, then resumes listening.
   */
  speakResponse(text: string): void {
    if (this.state === "idle") return;

    console.log("[voice] Speaking response, length:", text.length);
    this.setState("speaking");

    const cleaned = stripMarkdownForSpeech(text);
    if (!cleaned) {
      console.log("[voice] Cleaned text is empty, resuming listening");
      this.resumeListening();
      return;
    }

    const chunks = chunkText(cleaned, 400);
    const voice = selectBestVoice();
    console.log("[voice] Speaking", chunks.length, "chunks, voice:", voice?.name || "default");
    let chunkIndex = 0;

    const speakNext = () => {
      if (chunkIndex >= chunks.length || this.state !== "speaking") {
        console.log("[voice] Done speaking, resuming listening");
        this.resumeListening();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      if (voice) utterance.voice = voice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";

      utterance.onend = () => {
        chunkIndex++;
        speakNext();
      };

      utterance.onerror = (e) => {
        console.warn("[voice] TTS error on chunk", chunkIndex, e);
        chunkIndex++;
        speakNext();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  }

  // --- Private methods ---

  private handleSilence(): void {
    const text = this.accumulatedText.trim();
    console.log("[voice] Silence detected, accumulated text:", text);

    if (!text) return;

    // User is done speaking — send to AI
    this.setState("processing");
    this.accumulatedText = "";

    // Stop recognition to avoid picking up bot's speech
    try { this.recognition?.stop(); } catch { /* ok */ }

    console.log("[voice] Calling onUserDoneSpeaking with:", text);
    this.callbacks.onUserDoneSpeaking(text);
  }

  private setState(state: VoiceState): void {
    console.log("[voice] State:", this.state, "→", state);
    this.state = state;
    this.callbacks.onStateChange(state);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private resumeListening(): void {
    if (!this.shouldRestart) return;
    this.setState("listening");
    this.accumulatedText = "";
    this.restartRecognition();
  }

  private restartRecognition(): void {
    if (!this.recognition || !this.shouldRestart) return;

    try {
      this.recognition.stop();
    } catch { /* already stopped */ }

    setTimeout(() => {
      if (!this.shouldRestart || !this.recognition) return;
      try {
        this.recognition.start();
        console.log("[voice] Recognition restarted");
      } catch {
        setTimeout(() => {
          if (this.shouldRestart && this.recognition) {
            try {
              this.recognition.start();
              console.log("[voice] Recognition restarted (retry)");
            } catch (e) {
              console.error("[voice] Failed to restart recognition:", e);
            }
          }
        }, 1000);
      }
    }, 200);
  }
}

/** Check if the browser supports voice conversation */
export function isVoiceConversationSupported(): boolean {
  if (typeof window === "undefined") return false;
  const SpeechRecognitionAPI =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  return !!SpeechRecognitionAPI && "speechSynthesis" in window;
}
