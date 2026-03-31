/**
 * PDF Manual Ingestion Script
 *
 * Parses Peavey product manuals from PDFs, chunks them by section,
 * generates embeddings, and stores them in the local vector store.
 *
 * Usage: npx tsx scripts/ingest-manuals.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse");
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getEmbeddings } from "../src/lib/embeddings";
import { addChunks, clearStore, getChunkCount, type ManualChunk } from "../src/lib/vector-store";

// Map filenames to product names
const PRODUCT_MAP: Record<string, string> = {
  "6505 1992 original.pdf": "Peavey 6505 1992 Original",
  "pv 14bt.pdf": "Peavey PV14AT/PV14BT",
};

function classifyChunk(title: string, content: string): ManualChunk["chunkType"] {
  const lower = (title + " " + content).toLowerCase();

  if (lower.includes("specification") || lower.includes("rated power") || lower.includes("impedance:") || lower.includes("frequency response") || lower.includes("input z") || lower.includes("output levels")) {
    return "specification";
  }
  if (lower.includes("warning") || lower.includes("caution") || lower.includes("fuse") || lower.includes("shock") || lower.includes("safety") || lower.includes("ground")) {
    return "safety";
  }
  if (lower.includes("effects") || lower.includes("plate") || lower.includes("hall") || lower.includes("chorus") || lower.includes("delay") || lower.includes("auto-tune") || lower.includes("efx")) {
    return "effects";
  }
  if (lower.includes("connect") || lower.includes("setup") || lower.includes("patching") || lower.includes("speaker connection") || lower.includes("install") || lower.includes("bluetooth") || lower.includes("usb")) {
    return "setup";
  }
  if (lower.includes("troubleshoot") || lower.includes("problem") || lower.includes("noise") || lower.includes("hum") || lower.includes("clip") || lower.includes("distortion")) {
    return "troubleshooting";
  }
  if (lower.includes("gain") || lower.includes("knob") || lower.includes("switch") || lower.includes("control") || lower.includes("fader") || lower.includes("button") || lower.includes("eq")) {
    return "control";
  }

  return "general";
}

function chunkText(text: string, productName: string, pageNum: number): Omit<ManualChunk, "embedding">[] {
  const chunks: Omit<ManualChunk, "embedding">[] = [];

  // Split by common section patterns in Peavey manuals
  const sections = text.split(/\n(?=[A-Z][A-Z\s\/&]{3,}(?:\n|$))/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length < 30) continue; // Skip too-short fragments

    // Extract title (first line in caps)
    const lines = trimmed.split("\n");
    let title = lines[0].trim();
    if (title.length > 80) title = title.substring(0, 80);

    const content = trimmed;

    // Split very long sections into smaller chunks (~500 chars)
    if (content.length > 800) {
      const sentences = content.split(/(?<=[.!?])\s+/);
      let currentChunk = "";
      let chunkIndex = 0;

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > 600 && currentChunk.length > 100) {
          chunks.push({
            id: uuid(),
            productName,
            sectionTitle: `${title} (part ${chunkIndex + 1})`,
            content: currentChunk.trim(),
            pageNumber: pageNum,
            chunkType: classifyChunk(title, currentChunk),
          });
          currentChunk = sentence;
          chunkIndex++;
        } else {
          currentChunk += (currentChunk ? " " : "") + sentence;
        }
      }

      if (currentChunk.trim().length > 30) {
        chunks.push({
          id: uuid(),
          productName,
          sectionTitle: `${title} (part ${chunkIndex + 1})`,
          content: currentChunk.trim(),
          pageNumber: pageNum,
          chunkType: classifyChunk(title, currentChunk),
        });
      }
    } else {
      chunks.push({
        id: uuid(),
        productName,
        sectionTitle: title,
        content,
        pageNumber: pageNum,
        chunkType: classifyChunk(title, content),
      });
    }
  }

  return chunks;
}

async function ingestManual(filePath: string, productName: string) {
  console.log(`\n📄 Processing: ${productName}`);
  console.log(`   File: ${filePath}`);

  const buffer = readFileSync(filePath);
  const data = await pdf(buffer);

  console.log(`   Pages: ${data.numpages}`);
  console.log(`   Text length: ${data.text.length} chars`);

  // Chunk the entire text
  const rawChunks = chunkText(data.text, productName, 1);
  console.log(`   Raw chunks: ${rawChunks.length}`);

  // Generate embeddings in batches
  const batchSize = 20;
  const allChunks: ManualChunk[] = [];

  for (let i = 0; i < rawChunks.length; i += batchSize) {
    const batch = rawChunks.slice(i, i + batchSize);
    const texts = batch.map((c) => `${c.productName} - ${c.sectionTitle}: ${c.content}`);

    console.log(`   Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rawChunks.length / batchSize)}...`);

    const embeddings = await getEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      allChunks.push({
        ...batch[j],
        embedding: embeddings[j],
      });
    }
  }

  addChunks(allChunks);
  console.log(`   ✅ Added ${allChunks.length} chunks to vector store`);
}

async function main() {
  console.log("🔧 Peavey Manual Ingestion Pipeline");
  console.log("====================================\n");

  const manualsDir = path.join(process.cwd(), "data", "manuals");
  const files = readdirSync(manualsDir).filter((f) => f.endsWith(".pdf"));

  if (files.length === 0) {
    console.log("❌ No PDF files found in data/manuals/");
    return;
  }

  console.log(`Found ${files.length} manual(s):`);
  files.forEach((f) => console.log(`  - ${f}`));

  // Clear existing data
  clearStore();
  console.log("\n🗑️  Cleared existing vector store");

  for (const file of files) {
    const productName = PRODUCT_MAP[file] || file.replace(".pdf", "");
    await ingestManual(path.join(manualsDir, file), productName);
  }

  console.log(`\n✅ Ingestion complete! Total chunks: ${getChunkCount()}`);
}

main().catch(console.error);
