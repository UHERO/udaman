"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Single-row tab strip. When the tabs overflow, the row scrolls sideways
 * (scrollbar hidden) and ‹ › buttons at the right end page through it.
 * The active tab (aria-current) is scrolled into view on mount/change.
 */
export function ScrollTabs({
  label,
  activeKey,
  className,
  children,
}: {
  label: string;
  /** Changes when the active tab changes, to re-center it. */
  activeKey?: string | number;
  className?: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) =>
      e.left === left && e.right === right ? e : { left, right },
    );
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure, children]);

  // Bring the active tab into view (no animation on first paint).
  useEffect(() => {
    const el = scrollRef.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active) return;
    const pad = 16;
    if (active.offsetLeft < el.scrollLeft + pad) {
      el.scrollLeft = active.offsetLeft - pad;
    } else if (
      active.offsetLeft + active.offsetWidth >
      el.scrollLeft + el.clientWidth - pad
    ) {
      el.scrollLeft =
        active.offsetLeft + active.offsetWidth - el.clientWidth + pad;
    }
    measure();
  }, [activeKey, measure]);

  const page = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const overflow = edges.left || edges.right;

  return (
    <nav
      aria-label={label}
      className={cn("relative flex items-stretch", className)}
    >
      <div
        ref={scrollRef}
        className="relative flex min-w-0 flex-1 gap-x-5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{
          // Inline: the portal's global `scrollbar-width: thin` (unlayered)
          // would beat a Tailwind utility in Firefox.
          scrollbarWidth: "none",
          // Fade the clipped edge(s) so cut-off tabs read as "more".
          maskImage: overflow
            ? `linear-gradient(to right, ${
                edges.left ? "transparent, black 24px" : "black"
              }, ${edges.right ? "black calc(100% - 24px), transparent" : "black"})`
            : undefined,
        }}
      >
        {children}
      </div>
      {overflow && (
        <div className="flex shrink-0 items-center gap-0.5 pl-2">
          <PageButton
            label="Scroll tabs left"
            disabled={!edges.left}
            onClick={() => page(-1)}
          >
            <ChevronLeft className="size-4" />
          </PageButton>
          <PageButton
            label="Scroll tabs right"
            disabled={!edges.right}
            onClick={() => page(1)}
          >
            <ChevronRight className="size-4" />
          </PageButton>
        </div>
      )}
    </nav>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border text-muted-foreground hover:text-foreground hover:bg-muted flex size-7 items-center justify-center border transition-colors disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
