"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** URL-synced segmented filter. Writes ?<param>=value and resets page. */
export function FilterTabs({
  param,
  options,
  className,
}: {
  param: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? options[0]?.value;

  function select(value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value === options[0]?.value) next.delete(param);
    else next.set(param, value);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1", className)}>
      {options.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value}
            onClick={() => select(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-brand-700 text-white shadow-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
