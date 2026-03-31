import { tool } from "ai";
import { z } from "zod";
import { keywordSearch } from "@/lib/vector-store";

export const compareProducts = tool({
  description:
    "Compare two Peavey products side by side. Use when the user asks to compare products, asks 'which one is better', or wants to choose between products. Searches the knowledge base for both products and returns their specs for comparison.",
  inputSchema: z.object({
    product1: z.string().describe("First product name or keyword (e.g., '6505', 'CS 4080')"),
    product2: z.string().describe("Second product name or keyword (e.g., 'invective', 'CS 3000')"),
  }),
  execute: async ({ product1, product2 }) => {
    const results1 = keywordSearch(product1, 5);
    const results2 = keywordSearch(product2, 5);

    return {
      product1: {
        query: product1,
        found: results1.length > 0,
        info: results1.map(r => ({
          source: r.chunk.productName,
          section: r.chunk.sectionTitle,
          content: r.chunk.content.substring(0, 400),
          type: r.chunk.chunkType,
        })),
      },
      product2: {
        query: product2,
        found: results2.length > 0,
        info: results2.map(r => ({
          source: r.chunk.productName,
          section: r.chunk.sectionTitle,
          content: r.chunk.content.substring(0, 400),
          type: r.chunk.chunkType,
        })),
      },
      instruction: "Present the comparison as a markdown table with specs side by side. Include key differences and a recommendation based on use case.",
    };
  },
});
