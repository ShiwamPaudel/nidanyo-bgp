"use client";

import { useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { ReportSheet, type ReportSheetProps } from "@/components/print/report-sheet";

/**
 * Client wrapper for the printable report. Adds toggles to include or exclude the
 * letterhead header/footer — labs that print onto pre-printed physical letter pads
 * turn these off (the blank space stays reserved on every page).
 */
export function ReportPrintView(props: ReportSheetProps) {
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);

  return (
    <div className="min-h-screen bg-[#eef1ee]">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs text-muted-foreground">Printing on a pre-printed letter pad? Turn these off.</span>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-brand-700" checked={showHeader} onChange={(e) => setShowHeader(e.target.checked)} /> Include header
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-brand-700" checked={showFooter} onChange={(e) => setShowFooter(e.target.checked)} /> Include footer
          </label>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700">
            <Printer className="size-4" /> Print / Save PDF
          </button>
        </div>
      </div>
      <div className="py-6">
        <ReportSheet {...props} showHeader={showHeader} showFooter={showFooter} />
      </div>
    </div>
  );
}
