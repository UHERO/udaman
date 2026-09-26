import { EB_Garamond } from "next/font/google";

import { cn } from "@/lib/utils";

/** Garamond serif matching the original UHEROdata-Logo-color.svg lettering. */
const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

/** Colors sampled from UHEROdata-Logo-color.svg. */
const UHERO_BLUE = "#005373";
const UHERO_GRAY = "#6A6C74";
const UHERO_ORANGE = "#F5A01D";

/**
 * "data.UHERO" wordmark in HTML (replaces the UHERO.data SVG): blue "data",
 * orange dot, blue "UH", gray "ERO". Scales with font-size — set it through
 * `className` (e.g. `text-[28px]`).
 */
export function UheroDataLogo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="data.UHERO"
      className={cn(
        garamond.className,
        "inline-flex items-baseline leading-none font-medium whitespace-nowrap select-none",
        className,
      )}
    >
      <span aria-hidden style={{ color: UHERO_BLUE }}>
        data
      </span>
      <span
        aria-hidden
        className="mx-[0.06em] inline-block size-[0.17em] rounded-full"
        style={{ background: UHERO_ORANGE }}
      />
      <span aria-hidden className="tracking-[0.04em]">
        <span style={{ color: UHERO_BLUE }}>UH</span>
        <span style={{ color: UHERO_GRAY }}>ERO</span>
      </span>
    </span>
  );
}
