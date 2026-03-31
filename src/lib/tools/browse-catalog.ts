import { tool } from "ai";
import { z } from "zod";
import {
  PRODUCT_CATALOG,
  findProduct,
  searchProducts,
} from "@/lib/product-catalog";

export const browseCatalog = tool({
  description:
    "Browse the Peavey product catalog from peavey.com. Use this to find product images, pricing, stock availability, specifications, and features. Returns product photos that can be shown to the user. Use this when users ask about what products are available, want to see images, check prices, or compare products.",
  inputSchema: z.object({
    action: z
      .enum(["search", "details", "list_all"])
      .describe(
        "'search' to find products matching a query, 'details' to get full info on a specific product, 'list_all' to show all available products."
      ),
    query: z
      .string()
      .optional()
      .describe(
        "Search query or product ID. For 'search': keywords like 'tube amp' or '120 watt'. For 'details': product id like '6505-1992-original' or 'pv14at'."
      ),
  }),
  execute: async ({ action, query }) => {
    if (action === "list_all") {
      return {
        products: PRODUCT_CATALOG.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          currentPrice: p.currentPrice
            ? `$${p.currentPrice.toFixed(2)}`
            : "Contact dealer",
          inStock: p.inStock,
          imageUrl: p.images[0]?.url || null,
          pageUrl: p.pageUrl,
        })),
      };
    }

    if (action === "details" && query) {
      const product = findProduct(query);
      if (!product) {
        return {
          found: false,
          message: `No product found matching "${query}". Available products: ${PRODUCT_CATALOG.map((p) => p.name).join(", ")}`,
        };
      }
      return {
        found: true,
        product: {
          name: product.name,
          category: product.category,
          description: product.description,
          listPrice: product.listPrice
            ? `$${product.listPrice.toFixed(2)}`
            : null,
          currentPrice: product.currentPrice
            ? `$${product.currentPrice.toFixed(2)}`
            : "Contact dealer for pricing",
          savings: product.listPrice && product.currentPrice
            ? `$${(product.listPrice - product.currentPrice).toFixed(2)} off`
            : null,
          inStock: product.inStock,
          stockMessage: product.inStock
            ? "✅ In Stock — Ready to ship"
            : "❌ Currently unavailable",
          images: product.images.map((img) => ({
            url: img.url,
            alt: img.alt,
            view: img.view,
          })),
          specs: product.specs,
          features: product.features,
          pageUrl: product.pageUrl,
          manualAvailable: product.manualAvailable,
        },
      };
    }

    if (action === "search" && query) {
      const results = searchProducts(query);
      if (results.length === 0) {
        return {
          found: false,
          message: `No products found matching "${query}". Try different keywords.`,
          availableProducts: PRODUCT_CATALOG.map((p) => p.name),
        };
      }
      return {
        found: true,
        results: results.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description.substring(0, 150) + "...",
          currentPrice: p.currentPrice
            ? `$${p.currentPrice.toFixed(2)}`
            : "Contact dealer",
          inStock: p.inStock,
          imageUrl: p.images[0]?.url || null,
          features: p.features.slice(0, 5),
          pageUrl: p.pageUrl,
        })),
      };
    }

    return { error: "Please provide a query for search or details actions." };
  },
});
