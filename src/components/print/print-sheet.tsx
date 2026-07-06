"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";

/** Floating print toolbar (hidden when printing). Optionally auto-opens dialog. */
export function PrintToolbar({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
      <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
        <ArrowLeft className="size-4" /> Back
      </button>
      <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700">
        <Printer className="size-4" /> Print / Save PDF
      </button>
    </div>
  );
}
