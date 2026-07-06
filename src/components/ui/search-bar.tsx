"use client";

import { useState, useTransition, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** URL-synced search input. Debounced; writes ?q= and resets page. */
export function SearchBar({ placeholder = "Search…", className }: { placeholder?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set("q", value);
      else next.delete("q");
      next.delete("page");
      if ((params.get("q") ?? "") !== value) {
        startTransition(() => router.replace(`${pathname}?${next.toString()}`));
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative w-full max-w-sm", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {pending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : value ? (
          <button onClick={() => setValue("")} aria-label="Clear" className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
