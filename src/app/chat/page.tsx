import type { Metadata } from "next";
import { Chat } from "@/components/chat";

export const metadata: Metadata = {
  title: "PeaveyPro — Chat with our AI Support",
  description:
    "Get instant answers about Peavey amps, guitars, mixers, and pro audio gear. AI-powered product support available 24/7.",
  openGraph: {
    title: "PeaveyPro — AI Product Support",
    description:
      "Chat with PeaveyPro for instant help with your Peavey gear — setup, specs, troubleshooting, and recommendations.",
    type: "website",
  },
};

export default function ChatPage() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <Chat />
    </main>
  );
}
