import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TONES = {
  brand: "bg-brand-50 text-brand-700",
  info: "bg-info-50 text-info",
  danger: "bg-danger-50 text-destructive",
  warning: "bg-amber-50 text-amber-700",
  neutral: "bg-muted text-muted-foreground",
} as const;

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const inner = (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-lift">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-2xl font-bold tracking-tight tabular">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {Icon && (
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="size-5" />
        </span>
      )}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
