"use client";

import { ArrowRight, Sparkle } from "lucide-react";

export default function GlobalAiSearch() {  
  return (
    <div className="w-full px-5 mt-1">
      <div className="relative">
        {/* FLOATING AI CIRCLE (VISUALLY OUTSIDE, NOT CLIPPED) */}
        <div
          className="
            absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-9 w-9 rounded-full flex items-center justify-center z-20
            ai-pulse
          "
        >
          <div className="h-7 w-7 rounded-full border-2 relative overflow-hidden">
            <div className="absolute inset-0 rounded-full animate-gradient-spin" style={{background: 'conic-gradient(from 0deg, #6366f1, #a21caf, #6366f1 100%)'}} />
            <div className="absolute inset-1 rounded-full  bg-primary-foreground" />
          </div>
        </div>
      </div>

      {/* FLOAT ANIMATION */}
      <style>{`
        @keyframes ai-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        .ai-pulse {
          animation: ai-pulse 1.6s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes gradient-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-gradient-spin {
          animation: gradient-spin 2.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
