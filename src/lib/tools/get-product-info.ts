import { tool } from "ai";
import { z } from "zod";

const PRODUCTS = {
  "6505": {
    name: "Peavey 6505 1992 Original",
    category: "Guitar Amplifier",
    type: "All-tube head",
    power: "120W RMS into 16, 8, or 4 ohms",
    channels: "2 (Rhythm + Lead)",
    tubes: "Tube preamp and power amp stages",
    features: [
      "High and Normal gain inputs",
      "Channel Select (Rhythm/Lead)",
      "Lead Pre & Post Gain controls",
      "Rhythm Pre & Post Gain controls",
      "Bright switch (Rhythm channel)",
      "Crunch switch (Rhythm channel — converts to second lead channel)",
      "Passive Low, Mid, High EQ",
      "Resonance control (low frequency boost at speaker resonance point)",
      "Presence control (high frequency boost)",
      "Effects Loop (Send/Return) with footswitch bypass",
      "Preamp Out for mixing console/recording",
      "Impedance Selector (4, 8, 16 ohms)",
      "Standby switch",
      "Remote footswitch for channel select + effects loop bypass",
    ],
    impedanceOptions: "4, 8, or 16 ohms",
    minimumImpedance: "4 ohms",
    weight: "Not specified in manual",
    powerConsumption: "400 watts, 50/60 Hz, 120V AC",
    fuse: "5 amp",
    website: "peavey.com",
  },
  pv14: {
    name: "Peavey PV14AT/PV14BT",
    category: "Compact Mixer",
    type: "14-input stereo mixer",
    channels: "8 mic/line + stereo channels + media channel",
    features: [
      "8 combination XLR/1/4\" low noise mic preamps",
      "3-band EQ on all channels with Mid-Morph (cuts 250Hz or boosts 4kHz)",
      "4 channels of built-in compression (Ch 1-4)",
      "150 Hz hi-pass filter on all mic inputs",
      "Built-in digital effects with LCD display",
      "Bluetooth wireless connectivity",
      "USB-A MP3 playback",
      "USB-B stereo streaming audio in/out",
      "8 channels of direct out for recording",
      "48V phantom power (global)",
      "Kosmos-C bass and treble enhancement",
      "Channel 8 guitar input (1 Meg ohm, like 12AX7 tube input)",
      "Individual Solo function per channel",
      "EQ Bypass per mic channel",
      "Dual selectable control room outputs (A/B)",
      "Record output with independent level",
      "Master mic mute",
      "Stereo/Mono mode switch",
      "Precision 60mm master faders",
      "12-segment LED meter bridge",
      "Antares Auto-Tune on channels 1-4 (PV14AT only)",
    ],
    autoTune: "PV14AT only — 4 channels of Antares Auto-Tune with custom key feature",
    dimensions: '16.1875" wide x 17.3" deep x 2.1875" high',
    weight: "PV14BT: 12.12 lbs / PV14AT: 12.16 lbs",
    power: "100-240 VAC, 50/60 Hz, 24 Watts",
    website: "peavey.com",
  },
};

export const getProductInfo = tool({
  description:
    "Get structured product information and specifications for a Peavey product. Use this for quick spec lookups, feature lists, and product comparisons.",
  inputSchema: z.object({
    product: z
      .enum(["6505", "pv14", "both"])
      .describe("Which product to get info for: '6505' for the amplifier, 'pv14' for the mixer, 'both' for comparison."),
  }),
  execute: async ({ product }) => {
    if (product === "both") {
      return {
        products: [PRODUCTS["6505"], PRODUCTS["pv14"]],
        comparison:
          "The 6505 is a 120W all-tube guitar amplifier head designed for rock and metal. The PV14 is a 14-input compact mixer for live sound and recording.",
      };
    }
    return PRODUCTS[product];
  },
});
