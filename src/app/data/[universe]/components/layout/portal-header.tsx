"use client";

import Link from "next/link";
import { ChartLine, MessageSquare } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { useAnalyzer } from "../../lib/analyzer-context";
import { portalHref } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import { PortalLogo } from "./portal-logo";
import { SearchBox } from "./search-box";

/** Feedback destination (shown when `config.feedback`). */
const FEEDBACK_HREF =
  "mailto:uhero@hawaii.edu?subject=Data%20Portal%20Feedback";

/**
 * White top bar (port of `header`): logo → portal home, universe title,
 * series search, Analyzer link with selection count, optional feedback link.
 * The sidebar trigger shows on mobile only (the sidebar is a sheet there).
 *
 * On desktop the logo slot is exactly the sidebar's width (--sidebar-width
 * from SidebarProvider), so the title starts where the main column does.
 */
export function PortalHeader() {
  const { config } = usePortalConfig();
  const { count, analyzerHref } = useAnalyzer();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-neutral-200 bg-white pr-3 md:pr-4">
      <SidebarTrigger className="ml-2 rounded-none md:hidden" />
      <Link
        href={portalHref(config.universe)}
        className="flex h-full shrink-0 items-center px-3 md:w-(--sidebar-width) md:px-4"
        aria-label={`${config.title} home`}
      >
        <PortalLogo
          sizes="176px"
          preload
          className="h-9 w-auto max-w-full shrink-0 object-contain"
          wordmarkClassName="text-[30px]"
        />
      </Link>
      <Link
        href={portalHref(config.universe)}
        tabIndex={-1}
        className="text-muted-foreground hidden min-w-0 truncate text-xs font-medium tracking-widest uppercase md:block md:pl-6"
      >
        {config.title}
      </Link>

      <div className="ml-auto flex items-center gap-2 pl-3">
        <SearchBox className="hidden w-64 md:flex lg:w-72" />
        <Link
          href={analyzerHref}
          className="text-foreground flex h-8 items-center gap-1.5 px-2 text-sm hover:bg-neutral-100"
        >
          <ChartLine className="size-4" />
          <span className="hidden sm:inline">Analyzer</span>
          <span
            className={cn(
              "min-w-5 px-1 text-center text-xs font-semibold tabular-nums",
              count
                ? "bg-(--portal-accent) text-neutral-900"
                : "bg-neutral-100 text-neutral-500",
            )}
            aria-label={`${count} series selected`}
          >
            {count}
          </span>
        </Link>
        {config.feedback && (
          <a
            href={FEEDBACK_HREF}
            className="text-muted-foreground hover:text-foreground hidden h-8 items-center gap-1.5 px-2 text-sm hover:bg-neutral-100 sm:flex"
          >
            <MessageSquare className="size-4" />
            <span className="hidden lg:inline">Feedback</span>
          </a>
        )}
      </div>
    </header>
  );
}
