"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { CATEGORIES, DEFAULT_CATEGORY } from "../lib/categories";

export const KAUAI_BASE = "/data/kauai";

export const categoryHref = (slug: string) =>
  slug === DEFAULT_CATEGORY.slug ? KAUAI_BASE : `${KAUAI_BASE}/${slug}`;

/**
 * White masthead (old header + nav bar), two columns: title over the
 * category tabs + About on the left, the county seal on the right as a
 * square the height of that column. Sticky; the tabs scroll sideways on
 * phones.
 */
export function KauaiHeader() {
  const pathname = usePathname();
  const active =
    CATEGORIES.find((c) => pathname.endsWith(`/${c.slug}`)) ?? DEFAULT_CATEGORY;

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-[1280px] items-stretch gap-4 px-4 md:px-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <Link href={KAUAI_BASE} className="min-w-0 pt-3 pb-1.5">
            <div className="truncate text-lg font-semibold tracking-tight text-(--portal-primary) md:text-xl">
              Kauaʻi Economic Dashboard
            </div>
            <div className="text-muted-foreground truncate text-[11px] font-medium tracking-widest uppercase">
              County of Kauaʻi Office of Economic Development
            </div>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <nav
              aria-label="Dashboard sections"
              className="-ml-3 flex min-w-0 overflow-x-auto"
            >
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={categoryHref(c.slug)}
                  aria-current={c === active ? "page" : undefined}
                  className={cn(
                    "shrink-0 border-b-2 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors",
                    c === active
                      ? "border-(--portal-primary) font-semibold text-(--portal-primary)"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  {c.title}
                </Link>
              ))}
            </nav>
            <AboutDialog />
          </div>
        </div>
        {/* Official county seal: a fixed square about as tall as the title + tabs. */}
        <a
          href="https://www.kauai.gov/"
          target="_blank"
          rel="noreferrer"
          title="County of Kauaʻi"
          className="relative my-2 size-[72px] shrink-0 self-center md:size-[88px]"
        >
          <Image
            src="/data-portal/kauai/County_of_Kauai_Seal_Color_300px.png"
            alt="Seal of the County of Kauaʻi"
            fill
            sizes="(min-width: 768px) 88px, 72px"
            preload
            className="object-contain"
          />
        </a>
      </div>
    </header>
  );
}

function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger className="text-muted-foreground hover:text-foreground flex h-8 shrink-0 items-center gap-1.5 px-2 text-sm hover:bg-neutral-100">
        <Info className="size-4" />
        About
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <DialogTitle>About this dashboard</DialogTitle>
          <DialogDescription>
            Kauaʻi economic indicators at a glance, from the UHERO Data Portal.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-foreground list-disc space-y-2 pl-5 text-sm">
          <li>
            <b>Main chart.</b> The selected indicator&rsquo;s level (line, right
            axis) with its change from a year earlier (bars, left axis). Drag
            the slider or type dates beneath it to change the window; the
            table&rsquo;s trend lines follow it.
          </li>
          <li>
            <b>Choose and compare.</b> Click any row in the table to chart it.
            Tick <i>Compare</i> on another row to plot it against the first on
            the left axis.
          </li>
          <li>
            <b>Snapshot panel.</b> Growth rates (Major Indicators), arrivals by
            market (Visitor Industry), or jobs by industry (Labor Market) for
            one period. Its slider also sets the five periods shown in the
            table. In the jobs treemap, box area is proportional to jobs; hover
            for details.
          </li>
          <li>
            <b>Frequency, export, reset.</b> Switch between annual, quarterly
            and monthly data where available, download the page&rsquo;s series
            as CSV, or reset every selection.
          </li>
        </ul>
        <p className="text-muted-foreground text-xs">
          Questions or feedback:{" "}
          <a
            href="mailto:uhero@hawaii.edu?subject=Kauai%20Economic%20Dashboard"
            className="text-(--portal-primary) underline"
          >
            uhero@hawaii.edu
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
