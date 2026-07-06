"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "./input";
import { Button } from "./button";
import { NepaliDateInput } from "./nepali-date-input";
import type { CalendarSystem } from "@/lib/datetime";

/** URL-synced from/to date filter with quick presets. Uses a Nepali (BS) picker when cal="BS". */
export function DateRangeFilter({ cal = "AD" }: { cal?: CalendarSystem }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  function update(next: { from?: string; to?: string }) {
    const params = new URLSearchParams(sp.toString());
    if (next.from !== undefined) next.from ? params.set("from", next.from) : params.delete("from");
    if (next.to !== undefined) next.to ? params.set("to", next.to) : params.delete("to");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function preset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    update({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
  }

  function today() {
    const d = new Date().toISOString().slice(0, 10);
    update({ from: d, to: d });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {cal === "BS" ? (
        <>
          <NepaliDateInput value={from} onChange={(v) => update({ from: v })} placeholder="From date" ariaLabel="From date" />
          <span className="text-sm text-muted-foreground">to</span>
          <NepaliDateInput value={to} onChange={(v) => update({ to: v })} placeholder="To date" ariaLabel="To date" />
        </>
      ) : (
        <>
          <Input type="date" value={from} onChange={(e) => update({ from: e.target.value })} className="h-9 w-auto" aria-label="From date" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => update({ to: e.target.value })} className="h-9 w-auto" aria-label="To date" />
        </>
      )}
      <Button size="sm" variant="outline" onClick={today}>Today</Button>
      <Button size="sm" variant="outline" onClick={() => preset(7)}>7d</Button>
      <Button size="sm" variant="outline" onClick={() => preset(30)}>30d</Button>
    </div>
  );
}
