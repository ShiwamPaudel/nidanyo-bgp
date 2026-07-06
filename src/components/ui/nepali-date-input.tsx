"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  adToBs,
  bsToAd,
  bsMonthLength,
  bsYears,
  todayBs,
  BS_MONTH_NAMES,
  BS_MIN_YEAR,
  BS_MAX_YEAR,
  type BsDate,
} from "@/lib/nepali-date";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Bikram Sambat (Nepali) date picker. The value in/out is always an AD ISO
 * string ("yyyy-mm-dd") so the rest of the app keeps working in Gregorian —
 * only the picker UI is Nepali.
 */
export function NepaliDateInput({
  value,
  onChange,
  placeholder = "Select date",
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected: BsDate | null = useMemo(() => {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return adToBs(new Date(y, m - 1, d));
  }, [value]);

  // The month currently shown in the grid.
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const base = selected ?? todayBs();
    return { year: base.year, month: base.month };
  });

  useEffect(() => {
    if (open) {
      const base = selected ?? todayBs();
      setView({ year: base.year, month: base.month });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const days = bsMonthLength(view.year, view.month);
  const firstWeekday = useMemo(() => {
    const ad = bsToAd({ year: view.year, month: view.month, day: 1 });
    return ad ? ad.getDay() : 0;
  }, [view]);

  const todayIso = toLocalISO(new Date());
  const label = selected ? `${selected.day} ${BS_MONTH_NAMES[selected.month - 1]} ${selected.year}` : "";

  function shiftMonth(dir: 1 | -1) {
    setView((v) => {
      let month = v.month + dir;
      let year = v.year;
      if (month < 1) { month = 12; year -= 1; }
      if (month > 12) { month = 1; year += 1; }
      if (year < BS_MIN_YEAR || year > BS_MAX_YEAR) return v;
      return { year, month };
    });
  }

  function pick(day: number) {
    const ad = bsToAd({ year: view.year, month: view.month, day });
    if (ad) onChange(toLocalISO(ad));
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:border-brand-600"
      >
        <Calendar className="size-4 text-muted-foreground" />
        <span className={label ? "" : "text-muted-foreground"}>{label || placeholder}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-[248px] rounded-xl border border-border bg-card p-2 shadow-lift">
          <div className="mb-2 flex items-center justify-between gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded p-1 hover:bg-surface" aria-label="Previous month"><ChevronLeft className="size-4" /></button>
            <div className="flex items-center gap-1">
              <select
                value={view.month}
                onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
                className="rounded border border-border bg-card px-1.5 py-1 text-xs font-medium"
              >
                {BS_MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
              </select>
              <select
                value={view.year}
                onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
                className="rounded border border-border bg-card px-1.5 py-1 text-xs font-medium"
              >
                {bsYears().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded p-1 hover:bg-surface" aria-label="Next month"><ChevronRight className="size-4" /></button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => <span key={w} className="py-1 text-[10px] font-semibold uppercase text-muted-foreground">{w}</span>)}
            {Array.from({ length: firstWeekday }).map((_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const ad = bsToAd({ year: view.year, month: view.month, day });
              const iso = ad ? toLocalISO(ad) : "";
              const isSelected = value && iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md text-xs tabular hover:bg-brand-50",
                    isSelected ? "bg-brand-700 font-semibold text-white hover:bg-brand-700" : isToday ? "border border-brand-600 font-medium text-brand-700" : "text-foreground",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => { onChange(todayIso); setOpen(false); }}
              className="text-xs font-medium text-info hover:underline"
            >
              Today
            </button>
            {value && (
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-xs font-medium text-muted-foreground hover:underline">
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
