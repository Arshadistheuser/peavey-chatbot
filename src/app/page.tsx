"use client";

import { useState } from "react";
import { Chat } from "@/components/chat";
import { MessageCircle, X } from "lucide-react";

/**
 * Demo page that simulates how the widget would look on peavey.com.
 * Shows a mock product page with the chat widget floating on top.
 */
export default function DemoPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Simulated peavey.com header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Peavey Logo */}
            <div className="flex items-center gap-8">
              <img
                src="https://peavey.com/wp-content/uploads/2023/08/pv-logo-white-1.svg" style={{filter:"invert(1)"}}
                alt="Peavey Electronics"
                className="h-6 w-auto"
              />
              <nav className="hidden md:flex items-center gap-6 text-sm text-gray-500">
                <span className="hover:text-gray-900 cursor-pointer transition-colors">Amps</span>
                <span className="hover:text-gray-900 cursor-pointer transition-colors">Instruments</span>
                <span className="hover:text-gray-900 cursor-pointer transition-colors">Pro Audio</span>
                <span className="hover:text-gray-900 cursor-pointer transition-colors">Accessories</span>
                <span className="hover:text-gray-900 cursor-pointer transition-colors">Support</span>
              </nav>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="hover:text-gray-900 cursor-pointer transition-colors">Dealer Locator</span>
              <span className="hover:text-gray-900 cursor-pointer transition-colors">Cart</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <section className="relative bg-gradient-to-b from-gray-50 to-white py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.03),transparent_70%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-xs font-semibold tracking-[0.2em] text-red-500 uppercase mb-4">
                Guitar Amplifiers
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight">
                6505® 1992
                <span className="block text-red-500">Original</span>
              </h1>
              <p className="text-gray-500 text-base sm:text-lg leading-relaxed mb-6 max-w-md">
                The legendary amp that defined a genre and a generation. 120 watts of pure tube power, revered by studio and touring professionals since 1992.
              </p>
              <div className="flex items-center gap-4 mb-6">
                <div>
                  <div className="text-2xl font-bold text-gray-900">$1,699.99</div>
                  <div className="text-sm text-gray-400 line-through">$1,999.99</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-semibold border border-green-500/20">
                  In Stock
                </span>
              </div>
              <div className="flex gap-3">
                <button className="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold transition-colors">
                  Find a Dealer
                </button>
                <button className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm font-semibold transition-colors">
                  View Specs
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src="https://peavey.com/wp-content/uploads/2023/10/119251_38558.jpg"
                alt="Peavey 6505 1992 Original"
                className="max-h-[340px] w-auto object-contain drop-shadow-[0_20px_60px_rgba(220,38,38,0.15)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Specs section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold mb-8 text-gray-700">Specifications</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Power", value: "120W RMS" },
              { label: "Channels", value: "2 (Rhythm + Lead)" },
              { label: "Preamp Tubes", value: "5 × 12AX7" },
              { label: "Power Tubes", value: "4 × 6L6GC" },
              { label: "Impedance", value: "4/8/16 Ohm" },
              { label: "EQ", value: "3-Band Passive" },
              { label: "Effects Loop", value: "Footswitchable" },
              { label: "Technology", value: "All-Tube" },
            ].map((spec) => (
              <div
                key={spec.label}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4"
              >
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                  {spec.label}
                </div>
                <div className="text-sm font-semibold text-gray-700">{spec.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* More images */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold mb-8 text-gray-700">Product Gallery</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { src: "https://peavey.com/wp-content/uploads/2023/10/119251_38558.jpg", label: "Front" },
              { src: "https://peavey.com/wp-content/uploads/2023/10/119251_38559.jpg", label: "Back" },
              { src: "https://peavey.com/wp-content/uploads/2023/10/119251_38560.jpg", label: "Right" },
              { src: "https://peavey.com/wp-content/uploads/2023/10/119251_38561.jpg", label: "Left" },
            ].map((img) => (
              <div
                key={img.label}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-red-500/30 transition-colors cursor-pointer"
              >
                <img
                  src={img.src}
                  alt={`Peavey 6505 - ${img.label} view`}
                  className="w-full h-36 object-contain mb-2"
                />
                <div className="text-xs text-center text-gray-400">{img.label} View</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <img
              src="https://peavey.com/wp-content/uploads/2023/08/pv-logo-white-1.svg" style={{filter:"invert(1)"}}
              alt="Peavey"
              className="h-4 w-auto opacity-40"
            />
            <p className="text-xs text-gray-300">
              © 2026 Peavey Electronics Corporation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ===== CHAT WIDGET ===== */}
      {/* This is exactly how it would appear on peavey.com */}

      {/* Chat bubble button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${
          isOpen
            ? "bg-gray-100 backdrop-blur-sm border border-gray-300 shadow-none hover:bg-gray-200"
            : "bg-gradient-to-br from-red-600 to-red-900 hover:from-red-500 hover:to-red-800 shadow-red-900/40 hover:shadow-red-900/60 hover:scale-105"
        }`}
        aria-label={isOpen ? "Close chat" : "Open PeaveyPro"}
      >
        {isOpen ? (
          <X size={22} className="text-gray-900" />
        ) : (
          <MessageCircle size={22} className="text-gray-900" />
        )}
      </button>

      {/* Chat window */}
      <div
        className={`fixed bottom-24 right-5 z-50 w-[380px] h-[560px] rounded-2xl overflow-hidden border border-gray-200 shadow-2xl shadow-gray-400/40 transition-all duration-300 origin-bottom-right ${
          isOpen
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-95 opacity-0 pointer-events-none translate-y-3"
        }`}
        style={{
          maxHeight: "calc(100vh - 120px)",
          maxWidth: "calc(100vw - 40px)",
        }}
      >
        <Chat />
      </div>
    </div>
  );
}
