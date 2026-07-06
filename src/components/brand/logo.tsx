import { cn } from "@/lib/utils";

/** Inline brand wordmark — uses the Nidanyo droplet + colors. */
export function Logo({
  className,
  showTagline = false,
  size = "md",
}: {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? 28 : size === "lg" ? 44 : 34;
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <DropletMark size={dim} />
      <div className="leading-none">
        <div
          className={cn(
            "font-bold tracking-tight text-brand-700",
            size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl",
          )}
        >
          Nidanyo
        </div>
        {showTagline && (
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            From Liquid to Logic
          </div>
        )}
      </div>
    </div>
  );
}

/** The droplet glyph (red drop with inverted white triangle). */
export function DropletMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M24 3C24 3 9 21 9 31a15 15 0 0 0 30 0C39 21 24 3 24 3Z"
        fill="#FF3131"
      />
      <path d="M16.5 26h15L24 39 16.5 26Z" fill="#fff" />
    </svg>
  );
}
