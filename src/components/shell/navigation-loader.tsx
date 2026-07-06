"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LabLoader } from "@/components/ui/lab-loader";

/**
 * Instant navigation feedback. Next's `loading.tsx` only appears once the
 * server response begins — on prefetched routes that feels laggy. This shows
 * the branded loader the moment an internal link is clicked, and hides it as
 * soon as the route (path or query) actually changes.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide whenever the route finishes changing.
  useEffect(() => {
    setActive(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Show immediately on any internal link click (capture phase = before navigation).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page (incl. same query) → no navigation.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      // Don't cover print/report pages that open inline (they have their own loaders), but
      // still give feedback for normal in-app navigation.
      setActive(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setActive(false), 10000); // safety auto-hide
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="fixed inset-0 top-16 z-40 flex items-start justify-center bg-surface/85 backdrop-blur-[2px] lg:left-64" aria-busy="true" role="status">
      {/* top progress shimmer for extra instant feedback */}
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100">
        <div className="h-full w-1/3 bg-brand-700" style={{ animation: "nav-bar 1.1s ease-in-out infinite" }} />
      </div>
      <LabLoader />
    </div>
  );
}
