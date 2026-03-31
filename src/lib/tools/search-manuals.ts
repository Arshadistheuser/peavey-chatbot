import { tool, generateText } from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { keywordSearch } from "@/lib/vector-store";

// Known Peavey product lines for query expansion
const PRODUCT_LINES: Record<string, string[]> = {
  guitar: ["Raptor electric guitar", "HP 2 electric guitar", "Vandenberg guitar", "Predator guitar", "PXD guitar"],
  "bass guitar": ["Milestone bass", "Cirrus bass", "Zodiac bass"],
  amplifier: ["6505 amplifier", "invective amplifier", "Classic amplifier", "Vypyr amplifier", "ValveKing"],
  mixer: ["PV14 mixer", "XR mixer", "compact mixer", "powered mixer"],
  microphone: ["PVM microphone", "PV microphone", "condenser microphone", "dynamic microphone"],
  speaker: ["SP speaker", "dark matter speaker", "impulse speaker", "versarray"],
  "power amplifier": ["CS power amplifier", "IPR power amp", "Crest Audio"],
  cabinet: ["6505 cabinet", "guitar cabinet", "bass cabinet"],
};

function expandQuery(query: string): string[] {
  const lower = query.toLowerCase();
  const queries = [query];

  // Check if query matches a product category and expand
  for (const [category, expansions] of Object.entries(PRODUCT_LINES)) {
    if (lower.includes(category) || lower.includes(category.replace(" ", ""))) {
      queries.push(...expansions);
    }
  }

  // Common synonyms
  if (lower.includes("guitar") && !lower.includes("amp")) {
    queries.push("Raptor Plus electric guitar", "HP 2 Poplar electric guitar", "Vandenberg signature guitar", "Milestone bass guitar", "Delta Woods acoustic guitar");
  }
  if (lower.includes("mic")) {
    queries.push("PVM microphone", "PVR microphone", "condenser mic", "dynamic mic");
  }
  if (lower.includes("amp") && !lower.includes("guitar")) {
    queries.push("6505 guitar amplifier", "invective amplifier", "Vypyr amplifier", "Classic 30");
  }

  return [...new Set(queries)];
}

export const searchManuals = tool({
  description:
    "Search the Peavey knowledge base — includes product manuals, website content from peavey.com (all product pages, tech notes, FAQs, blog posts), specifications, and support articles. Use this to answer any question about Peavey products, features, pricing, availability, recommendations, setup, troubleshooting, and more. When searching for product categories (guitars, amps, mixers), search for specific model names.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query. Be specific — use product model names (e.g., 'Raptor Plus electric guitar', 'HP 2 guitar', '6505 amplifier'). For category searches, use specific series names."),
    product: z
      .string()
      .optional()
      .describe("Optional product name filter: '6505' or 'PV14'. Leave empty to search all products."),
  }),
  execute: async ({ query, product }) => {
    // Expand the query to cover more product lines
    const queries = expandQuery(query);

    // Search with all expanded queries and merge results
    const allResults = new Map<string, { chunk: ReturnType<typeof keywordSearch>[0]["chunk"]; score: number }>();

    for (const q of queries) {
      const results = keywordSearch(q, 5, product);
      for (const r of results) {
        const existing = allResults.get(r.chunk.id);
        if (!existing || r.score > existing.score) {
          allResults.set(r.chunk.id, r);
        }
      }
    }

    // Sort by score and take top results
    const results = Array.from(allResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (results.length === 0) {
      return {
        found: false,
        message: `No matching information found for "${query}". Try different keywords or ask about a specific product.`,
        results: [],
      };
    }

    return {
      found: true,
      resultCount: results.length,
      results: results.map((r) => ({
        product: r.chunk.productName,
        section: r.chunk.sectionTitle,
        content: r.chunk.content.substring(0, 500),
        type: r.chunk.chunkType,
        relevance: Math.round(r.score * 100) / 100,
      })),
    };
  },
});
