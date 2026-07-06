"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="scroll-thin -mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-brand-700 text-brand-700" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
