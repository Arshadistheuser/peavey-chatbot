/**
 * Text-to-Speech utility using the browser's Web Speech API.
 * Zero dependencies, zero cost — works in Chrome, Edge, Safari, Firefox.
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

/**
 * Strip markdown formatting so the speech sounds natural.
 */
export function stripMarkdownForSpeech(text: string): string {
  return (
    text
      // Remove follow-up and button tags
      .replace(/\[FOLLOW_UP:\s*.+?\]/g, "")
      .replace(/\[BUTTON:\s*.+?\]/g, "")
      // Remove image markdown
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      // Remove link markdown, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove bold/italic markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
      // Remove headers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove blockquotes
      .replace(/^>\s+/gm, "")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Remove table formatting
      .replace(/\|/g, ",")
      .replace(/^[-:|\s]+$/gm, "")
      // Remove bullet points
      .replace(/^[\s]*[-*+]\s+/gm, ". ")
      // Remove numbered list markers
      .replace(/^[\s]*\d+\.\s+/gm, ". ")
      // Clean up extra whitespace
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * Split text at sentence boundaries to avoid Chrome's ~15-second speech cutoff.
 */
export function chunkText(text: string, maxLength = 400): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Select the best English voice available in the browser.
 * Priority: Microsoft (Edge quality) > Google (Chrome quality) > any English voice.
 */
export function selectBestVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((v) => v.lang.startsWith("en"));

  if (englishVoices.length === 0) return voices[0] || null;

  // Prefer high-quality voices
  const preferred =
    englishVoices.find(
      (v) => v.name.includes("Microsoft") && v.name.includes("Online")
    ) ||
    englishVoices.find((v) => v.name.includes("Google")) ||
    englishVoices.find((v) => v.name.includes("Microsoft")) ||
    englishVoices.find((v) => v.name.includes("Samantha")) || // macOS
    englishVoices[0];

  cachedVoice = preferred;
  return preferred;
}

/**
 * Initialize voice loading. Some browsers load voices asynchronously.
 */
export function initVoices(): Promise<void> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      selectBestVoice();
      resolve();
      return;
    }
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        selectBestVoice();
        resolve();
      },
      { once: true }
    );
    // Timeout fallback in case event never fires
    setTimeout(resolve, 2000);
  });
}

/**
 * Speak text aloud. Returns a function to cancel speech.
 */
export function speakText(rawText: string): () => void {
  stopSpeaking();

  const cleaned = stripMarkdownForSpeech(rawText);
  if (!cleaned) return () => {};

  const chunks = chunkText(cleaned);
  const voice = selectBestVoice();

  let cancelled = false;

  const speakChunk = (index: number) => {
    if (cancelled || index >= chunks.length) return;

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";

    utterance.onend = () => {
      if (!cancelled) speakChunk(index + 1);
    };

    utterance.onerror = () => {
      if (!cancelled) speakChunk(index + 1);
    };

    window.speechSynthesis.speak(utterance);
  };

  speakChunk(0);

  return () => {
    cancelled = true;
    stopSpeaking();
  };
}

/**
 * Stop any ongoing speech.
 */
export function stopSpeaking(): void {
  window.speechSynthesis.cancel();
}

/**
 * Check if the browser supports speech synthesis.
 */
export function isTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
