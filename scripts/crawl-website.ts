/**
 * Peavey Website Crawler
 *
 * Crawls peavey.com product pages, support pages, and FAQs.
 * Extracts text content, specs, images, and pricing.
 * Stores everything in the vector store for RAG.
 *
 * Usage: npx tsx scripts/crawl-website.ts
 */

import * as cheerio from "cheerio";
import { v4 as uuid } from "uuid";
import { getEmbeddings } from "../src/lib/embeddings";
import { addChunks, getChunkCount, type ManualChunk } from "../src/lib/vector-store";
import { saveImageDb } from "../src/lib/tools/find-images";

const DELAY_MS = 1000; // Be respectful — 1 second between requests
const MAX_PAGES = 1500; // Full website crawl

// Sitemaps to crawl
const SITEMAPS = [
  "https://peavey.com/product-sitemap.xml",
  "https://peavey.com/page-sitemap.xml",
  "https://peavey.com/post-sitemap.xml",
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PeaveyBot/1.0 (Support Chatbot Knowledge Base Builder)",
        Accept: "text/html,application/xml",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(`  ⚠ Failed to fetch: ${url}`);
    return null;
  }
}

async function getUrlsFromSitemap(sitemapUrl: string): Promise<string[]> {
  console.log(`📄 Fetching sitemap: ${sitemapUrl}`);
  const xml = await fetchPage(sitemapUrl);
  if (!xml) return [];

  const $ = cheerio.load(xml, { xml: true });
  const urls: string[] = [];
  $("url > loc").each((_, el) => {
    urls.push($(el).text().trim());
  });

  console.log(`   Found ${urls.length} URLs`);
  return urls;
}

interface PageContent {
  url: string;
  title: string;
  productName: string;
  category: string;
  description: string;
  specs: Record<string, string>;
  features: string[];
  price: string | null;
  images: string[];
  bodyText: string;
}

function extractPageContent(html: string, url: string): PageContent | null {
  const $ = cheerio.load(html);

  // Remove noise elements
  $("script, style, noscript, iframe, svg, link, meta").remove();
  $("[class*='cookie'], [class*='popup'], [class*='modal'], [class*='overlay']").remove();

  const title = $("h1").first().text().trim() || $("title").text().trim().split("|")[0].trim();
  if (!title || title.length < 3) return null;

  // Get the page <title> for product name
  const pageTitle = $("title").text().trim().split("|")[0].split("–")[0].trim();
  const productName = $("h1").first().text().trim() || pageTitle;

  // Category from breadcrumbs or meta
  const category = $("[class*='breadcrumb'] a, [class*='posted_in'] a").map((_, el) => $(el).text().trim()).get().filter(t => t.length > 2).join(" > ");

  // Price — look for any dollar amounts in common price areas
  let price: string | null = null;
  const priceMatch = $("[class*='price'], [class*='Price']").first().text().match(/\$[\d,.]+/);
  if (priceMatch) price = priceMatch[0];

  // Get ALL text from the body, stripping nav/header/footer
  $("nav, header, footer, [class*='header'], [class*='footer'], [class*='nav-'], [class*='menu']").remove();

  // Specs — look for any table with 2 columns
  const specs: Record<string, string> = {};
  $("table tr").each((_, row) => {
    const cells = $(row).find("th, td");
    if (cells.length >= 2) {
      const key = $(cells[0]).text().trim();
      const val = $(cells[1]).text().trim();
      if (key && val && key !== val && key.length < 60 && val.length < 200) {
        specs[key] = val;
      }
    }
  });

  // Features — all list items
  const features: string[] = [];
  $("li").each((_, li) => {
    const text = $(li).text().trim();
    if (text.length > 10 && text.length < 200 && !text.includes("©") && !text.includes("Privacy")) {
      features.push(text);
    }
  });
  // Deduplicate and limit
  const uniqueFeatures = [...new Set(features)].slice(0, 20);

  // Images
  const images: string[] = [];
  $("img").each((_, img) => {
    const src = $(img).attr("src") || $(img).attr("data-src") || $(img).attr("data-large_image");
    if (src && src.startsWith("http") && (src.includes("peavey.com") || src.includes("wp-content")) && !src.includes("logo") && !src.includes("icon")) {
      images.push(src);
    }
  });

  // Description — get first substantial paragraph
  let description = "";
  $("p").each((_, p) => {
    const text = $(p).text().trim();
    if (!description && text.length > 50 && !text.includes("©") && !text.includes("shipping")) {
      description = text;
    }
  });

  // Full body text — grab everything from main content
  const bodyText = $("main, article, [class*='content'], [class*='product'], body")
    .first()
    .text()
    .replace(/[\t\n]+/g, "\n")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (bodyText.length < 100) return null;

  return {
    url,
    title,
    productName: productName || title,
    category,
    description,
    specs,
    features: uniqueFeatures,
    price,
    images: [...new Set(images)].slice(0, 5),
    bodyText: bodyText.substring(0, 3000), // Cap at 3000 chars
  };
}

function chunkPageContent(page: PageContent): Omit<ManualChunk, "embedding">[] {
  const chunks: Omit<ManualChunk, "embedding">[] = [];
  const source = `peavey.com: ${page.productName}`;

  // Description chunk
  if (page.description && page.description.length > 30) {
    chunks.push({
      id: uuid(),
      productName: source,
      sectionTitle: `${page.productName} — Description`,
      content: `${page.productName}\n${page.category ? `Category: ${page.category}\n` : ""}${page.price ? `Price: ${page.price}\n` : ""}\n${page.description}`,
      pageNumber: 0,
      chunkType: "general",
    });
  }

  // Specs chunk
  if (Object.keys(page.specs).length > 0) {
    const specsText = Object.entries(page.specs)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    chunks.push({
      id: uuid(),
      productName: source,
      sectionTitle: `${page.productName} — Specifications`,
      content: `${page.productName} Specifications:\n${specsText}`,
      pageNumber: 0,
      chunkType: "specification",
    });
  }

  // Features chunk
  if (page.features.length > 0) {
    chunks.push({
      id: uuid(),
      productName: source,
      sectionTitle: `${page.productName} — Features`,
      content: `${page.productName} Features:\n${page.features.map((f) => `- ${f}`).join("\n")}`,
      pageNumber: 0,
      chunkType: "general",
    });
  }

  // Body text chunks (split long content)
  if (page.bodyText.length > 200) {
    const sentences = page.bodyText.split(/(?<=[.!?])\s+/);
    let current = "";
    let partNum = 1;

    for (const sentence of sentences) {
      if (current.length + sentence.length > 500 && current.length > 100) {
        chunks.push({
          id: uuid(),
          productName: source,
          sectionTitle: `${page.productName} — Content (part ${partNum})`,
          content: current.trim(),
          pageNumber: 0,
          chunkType: "general",
        });
        current = sentence;
        partNum++;
      } else {
        current += (current ? " " : "") + sentence;
      }
    }
    if (current.length > 50) {
      chunks.push({
        id: uuid(),
        productName: source,
        sectionTitle: `${page.productName} — Content (part ${partNum})`,
        content: current.trim(),
        pageNumber: 0,
        chunkType: "general",
      });
    }
  }

  return chunks;
}

async function main() {
  console.log("🌐 Peavey Website Crawler");
  console.log("=========================\n");

  // Step 1: Gather all URLs from sitemaps
  let allUrls: string[] = [];
  for (const sitemap of SITEMAPS) {
    const urls = await getUrlsFromSitemap(sitemap);
    allUrls.push(...urls);
    await sleep(500);
  }

  // Deduplicate
  allUrls = [...new Set(allUrls)];
  console.log(`\n📋 Total unique URLs: ${allUrls.length}`);
  console.log(`   Crawling up to ${MAX_PAGES} pages...\n`);

  const pagesToCrawl = allUrls.slice(0, MAX_PAGES);
  const allChunks: Omit<ManualChunk, "embedding">[] = [];
  const allProductImages: Array<{ name: string; url: string; images: string[]; price: string | null }> = [];
  let crawled = 0;
  let failed = 0;

  for (const url of pagesToCrawl) {
    crawled++;
    process.stdout.write(`\r  Crawling ${crawled}/${pagesToCrawl.length}: ${url.substring(0, 60)}...`);

    const html = await fetchPage(url);
    if (!html) {
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    const content = extractPageContent(html, url);
    if (!content) {
      await sleep(DELAY_MS);
      continue;
    }

    const chunks = chunkPageContent(content);
    allChunks.push(...chunks);

    // Collect product images
    if (content.images.length > 0) {
      allProductImages.push({
        name: content.productName,
        url: content.url,
        images: content.images,
        price: content.price,
      });
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n\n✅ Crawled ${crawled - failed} pages successfully (${failed} failed)`);
  console.log(`   Generated ${allChunks.length} content chunks`);

  // Step 2: Generate embeddings and store
  if (allChunks.length === 0) {
    console.log("❌ No content extracted. Check if the website is accessible.");
    return;
  }

  console.log("\n🧠 Generating embeddings...");
  const batchSize = 20;
  const chunksWithEmbeddings: ManualChunk[] = [];

  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const texts = batch.map((c) => `${c.sectionTitle}: ${c.content.substring(0, 500)}`);

    process.stdout.write(`\r   Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)}...`);

    const embeddings = await getEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      chunksWithEmbeddings.push({
        ...batch[j],
        embedding: embeddings[j],
      });
    }
  }

  // Add to existing vector store (don't clear — keep manual chunks)
  addChunks(chunksWithEmbeddings);

  // Save product images database
  if (allProductImages.length > 0) {
    saveImageDb(allProductImages);
    console.log(`\n📸 Saved ${allProductImages.length} products with images`);
  }

  console.log(`\n✅ Website crawl complete!`);
  console.log(`   Added ${chunksWithEmbeddings.length} website chunks`);
  console.log(`   Total chunks in store: ${getChunkCount()}`);
  console.log(`   Products with images: ${allProductImages.length}`);
}

main().catch(console.error);
