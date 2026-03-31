/**
 * Vector store with BM25 keyword search + cosine similarity.
 * BM25 provides proper term-frequency/inverse-document-frequency scoring.
 * Persists to JSON on disk.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

export interface ManualChunk {
  id: string;
  productName: string;
  sectionTitle: string;
  content: string;
  pageNumber: number;
  chunkType: "specification" | "control" | "setup" | "safety" | "troubleshooting" | "effects" | "general";
  embedding: number[];
}

const STORE_PATH = path.join(process.cwd(), "data", "vectorstore", "chunks.json");

// Use globalThis to persist across Next.js dev mode HMR reloads
const globalStore = globalThis as unknown as {
  __peaveyChunks?: ManualChunk[];
  __peaveyLoaded?: boolean;
  __peaveyBM25?: BM25Index | null;
};

let chunks: ManualChunk[] = globalStore.__peaveyChunks || [];
let loaded = globalStore.__peaveyLoaded || false;
let bm25Index: BM25Index | null = globalStore.__peaveyBM25 || null;

function loadStore() {
  if (loaded) return;
  console.time("[vectorstore] load");
  if (existsSync(STORE_PATH)) {
    try {
      const raw = readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      // Strip embeddings from loaded data — we use BM25 only, saves ~90% memory
      chunks = parsed.map((c: ManualChunk) => ({
        id: c.id,
        productName: c.productName,
        sectionTitle: c.sectionTitle,
        content: c.content,
        pageNumber: c.pageNumber,
        chunkType: c.chunkType,
        embedding: [], // Don't load embeddings into memory
      }));
      console.log(`[vectorstore] Loaded ${chunks.length} chunks`);
      buildBM25Index();
    } catch (e) {
      console.error("[vectorstore] Failed to load:", e);
      chunks = [];
    }
  }
  loaded = true;
  globalStore.__peaveyChunks = chunks;
  globalStore.__peaveyLoaded = loaded;
  console.timeEnd("[vectorstore] load");
}

export function saveStore() {
  writeFileSync(STORE_PATH, JSON.stringify(chunks), "utf-8");
}

export function addChunks(newChunks: ManualChunk[]) {
  loadStore();
  chunks.push(...newChunks);
  saveStore();
  bm25Index = null; // Force rebuild on next search
}

export function clearStore() {
  chunks = [];
  loaded = true;
  bm25Index = null;
  saveStore();
}

export function getChunkCount(): number {
  loadStore();
  return chunks.length;
}

// ===== BM25 Implementation =====
// Simple but effective BM25 scoring without external dependencies

interface BM25Index {
  docFreq: Map<string, number>; // How many docs contain each term
  docLengths: number[]; // Length of each doc
  avgDocLength: number;
  totalDocs: number;
  tokenizedDocs: string[][]; // Tokens per doc
}

// Audio/music technical terms that should NOT be filtered as stop words
const TECHNICAL_TERMS = new Set([
  "amp", "eq", "aux", "efx", "mid", "low", "high", "pan", "gain",
  "bass", "treble", "mute", "solo", "mono", "stereo", "xlr", "trs",
  "ohm", "ohms", "rms", "usb", "led", "lcd", "dsp", "daw",
  "tube", "tubes", "fuse", "cab", "head", "combo", "rack",
  "mic", "pre", "post", "send", "return", "loop", "bus",
]);

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "what", "which",
  "who", "whom", "this", "that", "these", "those", "am", "not",
  "and", "but", "or", "nor", "for", "yet", "so", "in", "on", "at",
  "to", "from", "by", "with", "about", "how", "when", "where", "why",
  "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "than", "too", "very", "just", "also", "of", "it",
  "its", "my", "your", "his", "her", "our", "their", "me", "him",
  "us", "them", "i", "you", "he", "she", "we", "they",
  "get", "got", "like", "need", "want", "look", "show", "tell",
  "know", "think", "make", "take", "come", "see", "find", "give",
  "use", "say", "there", "here", "any", "many", "much",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\-\/]/g, " ") // Keep hyphens and slashes for model numbers
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .filter((w) => TECHNICAL_TERMS.has(w) || !STOP_WORDS.has(w))
    .flatMap((w) => {
      // Also split hyphenated words but keep the original
      if (w.includes("-")) {
        return [w, ...w.split("-").filter((p) => p.length > 1)];
      }
      return [w];
    });
}

function buildBM25Index() {
  const docFreq = new Map<string, number>();
  const docLengths: number[] = [];
  const tokenizedDocs: string[][] = [];

  for (const chunk of chunks) {
    const tokens = tokenize(`${chunk.productName} ${chunk.sectionTitle} ${chunk.content}`);
    tokenizedDocs.push(tokens);
    docLengths.push(tokens.length);

    const seen = new Set<string>();
    for (const token of tokens) {
      if (!seen.has(token)) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
        seen.add(token);
      }
    }
  }

  const avgDocLength = docLengths.reduce((a, b) => a + b, 0) / (docLengths.length || 1);

  bm25Index = {
    docFreq,
    docLengths,
    avgDocLength,
    totalDocs: chunks.length,
    tokenizedDocs,
  };
  globalStore.__peaveyBM25 = bm25Index;
  console.log(`[vectorstore] BM25 index built: ${chunks.length} docs`);
}

function bm25Score(queryTokens: string[], docIndex: number): number {
  if (!bm25Index) return 0;

  const k1 = 1.5;
  const b = 0.75;
  const docTokens = bm25Index.tokenizedDocs[docIndex];
  const docLen = bm25Index.docLengths[docIndex];

  // Count term frequency in doc
  const tf = new Map<string, number>();
  for (const token of docTokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  let score = 0;
  for (const term of queryTokens) {
    const termFreq = tf.get(term) || 0;
    if (termFreq === 0) continue;

    const df = bm25Index.docFreq.get(term) || 0;
    // IDF with smoothing
    const idf = Math.log(1 + (bm25Index.totalDocs - df + 0.5) / (df + 0.5));
    // BM25 TF component
    const tfNorm = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLen / bm25Index.avgDocLength)));

    score += idf * tfNorm;
  }

  return score;
}

// ===== Public Search API =====

export interface SearchResult {
  chunk: ManualChunk;
  score: number;
}

export function keywordSearch(
  query: string,
  topK: number = 8,
  productFilter?: string
): SearchResult[] {
  loadStore();

  if (!bm25Index) buildBM25Index();

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const results: SearchResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Product filter
    if (productFilter && !chunk.productName.toLowerCase().includes(productFilter.toLowerCase())) {
      continue;
    }

    const score = bm25Score(queryTokens, i);

    // Also add exact phrase bonus
    const contentLower = chunk.content.toLowerCase();
    const queryLower = query.toLowerCase();
    let bonus = 0;
    if (contentLower.includes(queryLower)) bonus += 5;
    if (chunk.sectionTitle.toLowerCase().includes(queryLower)) bonus += 8;

    const totalScore = score + bonus;
    if (totalScore > 0.1) {
      results.push({ chunk, score: totalScore });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function searchChunks(
  queryEmbedding: number[],
  topK: number = 8,
  productFilter?: string
): SearchResult[] {
  loadStore();

  let candidates = chunks;
  if (productFilter) {
    candidates = chunks.filter(
      (c) => c.productName.toLowerCase().includes(productFilter.toLowerCase())
    );
  }

  const scored = candidates.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function hybridSearch(
  queryEmbedding: number[],
  queryText: string,
  topK: number = 8,
  productFilter?: string
): SearchResult[] {
  const kwResults = keywordSearch(queryText, topK * 2, productFilter);
  const vectorResults = searchChunks(queryEmbedding, topK * 2, productFilter);

  const combined = new Map<string, SearchResult>();

  // BM25 keyword results get 70% weight (much more reliable than fallback embeddings)
  for (const r of kwResults) {
    const norm = Math.min(r.score / 20, 1);
    combined.set(r.chunk.id, { chunk: r.chunk, score: norm * 0.7 });
  }

  // Vector results get 30% weight
  for (const r of vectorResults) {
    const existing = combined.get(r.chunk.id);
    if (existing) {
      existing.score += r.score * 0.3;
    } else {
      combined.set(r.chunk.id, { chunk: r.chunk, score: r.score * 0.3 });
    }
  }

  const results = Array.from(combined.values());
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
