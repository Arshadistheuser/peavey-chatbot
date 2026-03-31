import { tool } from "ai";
import { z } from "zod";

/**
 * Product image database — scraped from peavey.com.
 * Maps product URL slugs to their image URLs.
 * This is populated by the website crawler.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";

const IMAGES_PATH = path.join(process.cwd(), "data", "product-images.json");

interface ProductImages {
  name: string;
  url: string;
  images: string[];
  price: string | null;
}

let imageDb: ProductImages[] = [];
let loaded = false;

function loadImageDb() {
  if (loaded) return;
  if (existsSync(IMAGES_PATH)) {
    try {
      imageDb = JSON.parse(readFileSync(IMAGES_PATH, "utf-8"));
    } catch {
      imageDb = [];
    }
  }
  loaded = true;
}

export function saveImageDb(data: ProductImages[]) {
  writeFileSync(IMAGES_PATH, JSON.stringify(data, null, 2), "utf-8");
  imageDb = data;
  loaded = true;
}

export const findProductImages = tool({
  description:
    "Find product images from peavey.com. Use this whenever the user asks to see a product, wants to know what something looks like, or when showing a product recommendation. Returns image URLs that MUST be displayed using markdown image syntax: ![alt](url)",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Product name or keywords to search for (e.g., '6505', 'guitar strap', 'power amplifier', 'microphone')"),
  }),
  execute: async ({ query }) => {
    loadImageDb();

    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 2);

    const results = imageDb
      .map((product) => {
        const searchText = product.name.toLowerCase();
        let score = 0;
        for (const word of words) {
          if (searchText.includes(word)) score += 1;
        }
        if (searchText.includes(q)) score += 5;
        return { ...product, score };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (results.length === 0) {
      return {
        found: false,
        message: `No product images found for "${query}".`,
      };
    }

    return {
      found: true,
      products: results.map((p) => ({
        name: p.name,
        pageUrl: p.url,
        price: p.price,
        images: p.images,
        mainImage: p.images[0] || null,
      })),
      instruction:
        "IMPORTANT: Display the product images using markdown syntax like ![Product Name](image_url) in your response.",
    };
  },
});
