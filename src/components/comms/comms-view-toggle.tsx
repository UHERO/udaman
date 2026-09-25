import Link from "next/link";

import { cn } from "@/lib/utils";

export type CommsView = "list" | "board" | "reviewing";

/**
 * Switches between the status-filtered list (all comms), the author's
 * cross-comm review board ("Your Publications"), and the reviewer's
 * cross-comm queue ("Your Reviews"). A separate axis from the status filter
 * tabs — kept out of PreReleaseStatusTabs so the two don't conflate.
 *
 * With no `?view=`, the page picks whichever of these the user actually has
 * something in (see defaultView in page.tsx) rather than always landing on
 * the all-forms list.
 */
export function CommsViewToggle({ active }: { active: CommsView }) {
  const views: { key: CommsView; label: string; href: string }[] = [
    { key: "list", label: "All forms", href: "/comms?view=list" },
    { key: "board", label: "Your Publications", href: "/comms?view=board" },
    {
      key: "reviewing",
      label: "Your Reviews",
      href: "/comms?view=reviewing",
    },
  ];

  return (
    <nav aria-label="Switch view" className="flex gap-1 text-sm">
      {views.map((v) => {
        const isActive = v.key === active;
        return (
          <Link
            key={v.key}
            href={v.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
