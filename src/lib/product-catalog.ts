/**
 * Product catalog with data pulled from peavey.com
 * Includes images, pricing, specs, and stock status.
 *
 * This data is pre-fetched from the website and can be refreshed.
 * In production, this would be a scheduled scrape or API integration.
 */

export interface ProductImage {
  url: string;
  alt: string;
  view: string; // "front" | "back" | "angle-left" | "angle-right" | "detail"
}

export interface ProductListing {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  listPrice: number | null;
  currentPrice: number | null;
  currency: string;
  inStock: boolean;
  images: ProductImage[];
  specs: Record<string, string>;
  features: string[];
  pageUrl: string;
  manualAvailable: boolean;
}

/**
 * Pre-scraped product data from peavey.com
 * Last updated: 2026-03-28
 */
export const PRODUCT_CATALOG: ProductListing[] = [
  {
    id: "6505-1992-original",
    name: "Peavey 6505® 1992 Original Guitar Amp Head",
    slug: "6505-1992-original",
    category: "Guitar Amplifiers",
    description:
      "The legendary Peavey 6505 1992 Original is the ultimate rock 'n' roll guitar amp, featuring super-rock crunch, harmonic-rich sustain and metal drive capabilities. This amp is THE guitar amp that defined a genre and a generation and has been revered by studio and touring professionals since 1992.",
    listPrice: 1999.99,
    currentPrice: 1699.99,
    currency: "USD",
    inStock: true,
    images: [
      {
        url: "https://peavey.com/wp-content/uploads/2023/10/119251_38558.jpg",
        alt: "Peavey 6505 1992 Original - Front View",
        view: "front",
      },
      {
        url: "https://peavey.com/wp-content/uploads/2023/10/119251_38559.jpg",
        alt: "Peavey 6505 1992 Original - Back View",
        view: "back",
      },
      {
        url: "https://peavey.com/wp-content/uploads/2023/10/119251_38560.jpg",
        alt: "Peavey 6505 1992 Original - Right Angle",
        view: "angle-right",
      },
      {
        url: "https://peavey.com/wp-content/uploads/2023/10/119251_38561.jpg",
        alt: "Peavey 6505 1992 Original - Left Angle",
        view: "angle-left",
      },
    ],
    specs: {
      "Product Type": "Guitar Amp Head",
      "Power Output": "120 Watts RMS",
      "Preamp Tubes": "5 x 12AX7",
      "Power Tubes": "4 x 6L6GC",
      Channels: "2 (Rhythm + Lead)",
      Impedance: "16, 8, or 4 Ohms (switchable)",
      EQ: "Shared three-band (Low, Mid, High)",
      Technology: "All-Tube",
      Features:
        "Bright/Crunch voicing switches, footswitchable effects loop, preamp output",
      Color: "Black",
      "Shipping Weight": "24.494 kg (54 lbs)",
      Dimensions: '28.5 × 14 × 12.25 in',
      SKU: "03619250",
    },
    features: [
      "120W all-tube power",
      "2 channels (Rhythm + Lead)",
      "5 x 12AX7 preamp tubes",
      "4 x 6L6GC power tubes",
      "Bright and Crunch switches",
      "Footswitchable effects loop",
      "Impedance selector (4/8/16 ohm)",
      "Preamp output for recording",
      "Includes remote footswitch",
    ],
    pageUrl: "https://peavey.com/product/6505-1992-original-guitar-amp-head/",
    manualAvailable: true,
  },
  {
    id: "pv14at",
    name: "Peavey PV®14AT Compact Mixer",
    slug: "pv-14-at",
    category: "Compact Mixers",
    description:
      "The PV14AT is a studio-quality mixing console featuring 8 channels of reference-quality mic preamps, built-in digital effects with LCD display, Bluetooth wireless input, Antares Auto-Tune on channels 1-4, USB media playback, and 8 direct outputs for recording. Perfect for small venue performances or home recording.",
    listPrice: null,
    currentPrice: null,
    currency: "USD",
    inStock: false,
    images: [],
    specs: {
      "Product Type": "Compact Mixer",
      "Input Channels": "14 (8 mic/line + stereo + media)",
      "Mic Preamps": "8 combination XLR/1/4\" low noise",
      EQ: "3-band with Mid-Morph on channels 1-8",
      Compression: "4 channels (Ch 1-4)",
      Effects: "Built-in digital effects with LCD display",
      "Auto-Tune": "Antares Auto-Tune on channels 1-4 (AT model only)",
      Connectivity: "Bluetooth, USB-A (MP3), USB-B (streaming)",
      "Phantom Power": "48V global",
      Outputs: "Balanced XLR + 1/4\" stereo main, AUX send, 8 direct outs",
      Dimensions: '16.1875" × 17.3" × 2.1875"',
      Weight: "12.16 lbs (5.52 kg)",
      Power: "100-240 VAC, 50/60 Hz, 24 Watts",
    },
    features: [
      "8 reference-quality mic preamps",
      "Antares Auto-Tune on 4 channels",
      "Bluetooth wireless connectivity",
      "Built-in digital effects with LCD",
      "USB-A MP3 playback",
      "USB-B streaming audio in/out",
      "8 direct outputs for recording",
      "48V phantom power",
      "Kosmos-C bass/treble enhancement",
      "Guitar input (1 MegΩ) on Channel 8",
    ],
    pageUrl: "https://peavey.com",
    manualAvailable: true,
  },
];

export function findProduct(query: string): ProductListing | null {
  const q = query.toLowerCase();
  return (
    PRODUCT_CATALOG.find(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    ) || null
  );
}

export function searchProducts(query: string): ProductListing[] {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);

  return PRODUCT_CATALOG.filter((p) => {
    const searchText = `${p.name} ${p.category} ${p.description} ${Object.values(p.specs).join(" ")} ${p.features.join(" ")}`.toLowerCase();
    return words.some((w) => searchText.includes(w));
  });
}
