"use client";

import { useEffect, useState } from "react";
import { DropletMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const QUOTES = [
  "Every drop tells a story.",
  "From liquid to logic.",
  "Precision is the heart of diagnosis.",
  "Small samples, big answers.",
  "In data we trust, in science we verify.",
  "Accuracy today, confidence tomorrow.",
  "The lab never sleeps, and neither does care.",
  "Measure twice, report once.",
  "Behind every result is a healthier life.",
  "Quality is not an act, it is a habit.",
];

/** Fancy branded loader with a rotating brand ring, orbiting cells, and a cycling lab quote. */
export function LabLoader({ label = "Preparing your workspace", className }: { label?: string; className?: string }) {
  const [quote, setQuote] = useState(() => Math.floor(Math.random() * QUOTES.length));
  useEffect(() => {
    const t = setInterval(() => setQuote((q) => (q + 1) % QUOTES.length), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={cn("flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center", className)}>
      <div className="relative grid size-24 place-items-center">
        {/* gradient progress ring */}
        <div className="nido-ring absolute inset-0 rounded-full" />
        {/* orbiting brand cells */}
        <span className="absolute size-2.5 rounded-full bg-[#075323]" style={{ animation: "nido-orbit 1.6s linear infinite" }} />
        <span className="absolute size-2.5 rounded-full bg-[#144FCA]" style={{ animation: "nido-orbit 1.6s linear infinite", animationDelay: "-0.53s" }} />
        <span className="absolute size-2.5 rounded-full bg-[#FF3131]" style={{ animation: "nido-orbit 1.6s linear infinite", animationDelay: "-1.06s" }} />
        {/* center droplet */}
        <span style={{ animation: "nido-pulse 1.4s ease-in-out infinite" }}>
          <DropletMark size={34} />
        </span>
      </div>

      {/* progressing bars */}
      <div className="flex items-end gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-5 w-1.5 origin-bottom rounded-full"
            style={{
              background: ["#075323", "#144FCA", "#16A34A", "#144FCA", "#075323"][i],
              animation: "nido-bar 1s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-brand-700">{label}…</p>
        <p key={quote} className="nido-quote-enter max-w-xs text-sm italic text-muted-foreground">“{QUOTES[quote]}”</p>
      </div>
    </div>
  );
}
