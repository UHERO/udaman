"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  DollarSign,
  Fence,
  FileText,
  Gavel,
  Hammer,
  History,
  Home,
  Info,
  Landmark,
  Layers,
  ListOrdered,
  MapPin,
  Maximize2,
  Minimize2,
  PlusSquare,
  Receipt,
  TreePine,
  Users,
  Warehouse,
  Wheat,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFullWidth } from "@/hooks/use-full-width";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "About", icon: Info, segment: "" },
  { label: "Properties", icon: Home, segment: "properties" },
  { label: "Parcels", icon: MapPin, segment: "parcels" },
  { label: "Owners", icon: Users, segment: "owners" },
  { label: "Assessments", icon: DollarSign, segment: "assessments" },
  { label: "Sales", icon: Landmark, segment: "sales" },
  {
    label: "Residential Improvements",
    icon: Hammer,
    segment: "residential-improvements",
  },
  {
    label: "Commerical Improvements",
    icon: Hammer,
    segment: "commercial-improvements",
  },
  { label: "Condo Projects", icon: Building, segment: "condo-projects" },
  { label: "Condo Units", icon: Building, segment: "condo-units" },
  { label: "Permits", icon: FileText, segment: "permits" },
  { label: "Appeals", icon: Gavel, segment: "appeals" },
  { label: "Dedications", icon: BookOpen, segment: "dedications" },
  { label: "Land Class", icon: Layers, segment: "land-classifications" },
  { label: "Tax Bills", icon: Receipt, segment: "tax-bills" },
  { label: "Tax History", icon: History, segment: "tax-summary" },
  { label: "Tax Details", icon: ListOrdered, segment: "tax-details" },
  { label: "Tax Payments", icon: CreditCard, segment: "tax-payments" },
  { label: "Tax Credits", icon: Coins, segment: "tax-credits" },
  { label: "Agg. Assessments", icon: Wheat, segment: "ag-assessments" },
  { label: "Accessories", icon: Fence, segment: "accessory-structures" },
  {
    label: "Commercial Details",
    icon: Warehouse,
    segment: "commercial-details",
  },
  {
    label: "Residential Additions",
    icon: PlusSquare,
    segment: "residential-additions",
  },
  { label: "Yard Impr", icon: TreePine, segment: "yard-improvements" },
] as const;

const SCROLL_AMOUNT = 200;

export function HhdbTabs() {
  const pathname = usePathname();
  const base = "/hhdb";

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { fullWidth, toggleWidth } = useFullWidth();

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex items-center border-b">
      {/* Scrollable tabs area */}
      <div className="relative min-w-0 flex-1">
        {/* Left scroll indicator */}
        {canScrollLeft && (
          <div className="absolute top-0 bottom-0 left-0 z-10 flex items-center">
            <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r to-transparent" />
            <button
              onClick={() => scroll("left")}
              className="bg-background hover:bg-muted relative z-10 flex h-full items-center border-r px-1"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="text-muted-foreground h-4 w-4" />
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          className="scrollbar-none overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-center gap-1 whitespace-nowrap">
            {TABS.map((tab) => {
              const href = tab.segment ? `${base}/tables/${tab.segment}` : base;
              const isActive = tab.segment
                ? pathname.startsWith(`${base}/tables/${tab.segment}`)
                : pathname === base;
              return (
                <Link
                  key={tab.segment || "about"}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right scroll indicator */}
        {canScrollRight && (
          <div className="absolute top-0 right-0 bottom-0 z-10 flex items-center">
            <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l to-transparent" />
            <button
              onClick={() => scroll("right")}
              className="bg-background hover:bg-muted relative z-10 flex h-full items-center border-l px-1"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Width toggle */}
      <div className="flex shrink-0 items-center border-l px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleWidth}
          title={fullWidth ? "Constrain width" : "Full width"}
        >
          {fullWidth ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
