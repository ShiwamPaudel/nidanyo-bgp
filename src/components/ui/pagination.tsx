import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Server-friendly pagination: builds links from current searchParams. */
export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const makeHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string" && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-2 px-1 py-3 text-sm">
      <p className="text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={makeHref(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="size-4" />
        </PageLink>
        <span className="px-2 text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <PageLink href={makeHref(page + 1)} disabled={page >= totalPages}>
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled?: boolean; children: React.ReactNode }) {
  const cls = cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-colors",
    disabled ? "pointer-events-none opacity-40" : "hover:bg-muted",
  );
  if (disabled) return <span className={cls}>{children}</span>;
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
