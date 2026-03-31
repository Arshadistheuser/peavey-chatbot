/**
 * Embedding utility using Google Gemini's free embedding API.
 * Falls back to a simple TF-IDF-like approach if no API key is set.
 */

import { google } from "@ai-sdk/google";
import { embedMany, embed } from "ai";

const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: embeddingModel,
      value: text,
    });
    return embedding;
  } catch (error) {
    console.warn("Embedding API failed, using fallback:", error);
    return simpleEmbedding(text);
  }
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: texts,
    });
    return embeddings;
  } catch (error) {
    console.warn("Batch embedding API failed, using fallback:", error);
    return texts.map(simpleEmbedding);
  }
}

/**
 * Simple hash-based embedding fallback when no API key is available.
 * Not as good as real embeddings but works for keyword-heavy technical content.
 */
function simpleEmbedding(text: string): number[] {
  const dim = 256;
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }

  // Normalize
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (mag > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= mag;
  }

  return vec;
}
