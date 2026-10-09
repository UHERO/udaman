import Link from "next/link";

import { cn } from "@/lib/utils";

export type CommsView = "list" | "board" | "reviewing";

/**
 * Switches between the status-filtered list ("Submissions"), the author's
 * cross-comm review board (Your reviews "Author"), and the reviewer's
 * cross-comm queue (Your reviews "Reviewer"). A separate axis from the status filter
 * tabs — kept out of PreReleaseStatusTabs so the two don't conflate.
 *
 * With no `?view=`, the page picks whichever of these the user actually has
 * something in (see defaultView in page.tsx) rather than always landing on
 * the all-forms list.
 */
export function CommsViewToggle({ active }: { active: CommsView }) {
  const link = (key: CommsView, label: string) => {
    const isActive = key === active;
    return (
      <Link
        href={`/comms?view=${key}`}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          isActive
            ? "bg-ublue/15 text-ublue ring-ublue/40 font-semibold ring-1"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {label}
      </Link>
    );
  };

  // "Your reviews" heads the two board views as a group, so the rule and
  // small label do the work a "Your reviews:" prefix would.
  return (
    <nav
      aria-label="Switch view"
      className="flex flex-wrap items-center gap-1 text-sm"
    >
      {link("list", "Submissions")}
      <div className="bg-border mx-2 h-5 w-px" aria-hidden />
      <div
        role="group"
        aria-labelledby="comms-reviews-label"
        className="flex items-center gap-1"
      >
        <span
          id="comms-reviews-label"
          className="text-muted-foreground mr-1 text-[11px] font-medium tracking-[0.14em] uppercase"
        >
          Your reviews
        </span>
        {link("board", "Author")}
        {link("reviewing", "Reviewer")}
      </div>
    </nav>
  );
}
