/**
 * Centralized route access configuration.
 *
 * Consumed by:
 *  - Client components (sidebar) — no "server-only" import
 *  - Edge middleware (route enforcement)
 *  - Homepage (card generation)
 *
 * Pure data + pure functions only (no side-effects!).
 */

import {
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowUpToLine,
  BookOpen,
  Building2,
  ChartLine,
  ClipboardList,
  FileSpreadsheet,
  LineChart,
  SearchSlash,
  Shield,
  TableProperties,
  type LucideIcon,
} from "lucide-react";

export type Role = "external" | "internal" | "admin" | "dev";

export type RouteChild = {
  label: string;
  path: string;
  roles?: Role[];
  universes?: string[];
};

export type RouteEntry = {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: Role[];
  universes?: string[];
  children?: RouteChild[];
  /** Where this route appears in the UI: "rail" (app rail) or "sidebar" (default) */
  location?: "rail" | "sidebar";
};

/**
 * Master route manifest.
 *
 * Sidebar routes: paths are relative to `/udaman/{universe}`.
 * Rail routes: paths are absolute top-level (e.g. `/admin`, `/hhdb`, `/docs`).
 */
export const ROUTES: RouteEntry[] = [
  {
    label: "Time Series",
    path: "/series",
    icon: TableProperties,
    roles: ["internal", "admin", "dev"],
  },
  {
    label: "Analyze",
    path: "/analyze",
    icon: LineChart,
    roles: ["internal", "admin", "dev"],
  },
  {
    label: "Clipboard",
    path: "/clipboard",
    icon: ClipboardList,
    roles: ["internal", "admin", "dev"],
  },
  {
    label: "Data Portal Catalog",
    path: "/catalog",
    icon: ChartLine,
    roles: ["internal", "admin", "dev"],
    children: [
      { label: "Universe", path: "/catalog" },
      { label: "Categories", path: "/catalog/categories" },
      { label: "Data Lists", path: "/catalog/data-lists" },
      { label: "Measurements", path: "/catalog/measurements" },
      { label: "Geographies", path: "/catalog/geographies" },
      { label: "Units", path: "/catalog/units" },
      { label: "Sources", path: "/catalog/sources" },
      { label: "Source Details", path: "/catalog/source-details" },
    ],
  },
  {
    label: "Data Tools",
    path: "/data-tools",
    icon: FileSpreadsheet,
    roles: ["internal", "admin", "dev"],
    children: [
      { label: "TSD Convert & Inspect", path: "/data-tools/tsd" },
      { label: "Timeline Events", path: "/data-tools/timeline" },
    ],
  },
  {
    label: "Downloads",
    path: "/downloads",
    icon: ArrowDownToLine,
    roles: ["internal", "admin", "dev"],
  },
  {
    label: "Exports",
    path: "/exports",
    icon: ArrowLeftFromLine,
    roles: ["internal", "admin", "dev"],
  },
  {
    label: "Investigations",
    path: "/investigations",
    icon: SearchSlash,
    roles: ["internal", "admin", "dev"],
    children: [
      { label: "Dashboard", path: "/investigations" },
      { label: "Missing Metadata", path: "/investigations/no-source" },
      { label: "Quarantine", path: "/investigations/quarantine" },
    ],
  },
  {
    label: "Forecast Snapshots",
    path: "/forecast/snapshots",
    icon: BookOpen,
    roles: ["internal", "admin", "dev"],
  },
  {
    label: "Uploads",
    path: "/uploads",
    icon: ArrowUpToLine,
    roles: ["external", "internal", "admin", "dev"],
    children: [
      {
        label: "Econ",
        path: "/uploads/econ",
        roles: ["external", "internal", "admin", "dev"],
      },
      {
        label: "Tour",
        path: "/uploads/tour",
        roles: ["external", "internal", "admin", "dev"],
      },
      {
        label: "Forecast",
        path: "/uploads/forecast",
        roles: ["internal", "admin", "dev"],
      },
      {
        label: "Factbook",
        path: "/uploads/factbook",
        roles: ["internal", "admin", "dev"],
        universes: ["HHF"],
      },
    ],
  },
  // ── Rail routes (top-level, absolute paths) ──
  {
    label: "Admin",
    path: "/admin",
    icon: Shield,
    roles: ["admin", "dev"],
    location: "rail",
    children: [
      { label: "Permissions", path: "/admin" },
      { label: "Feature Toggles", path: "/admin/feature-toggles" },
      { label: "Workers", path: "/admin/workers" },
      { label: "Schedules", path: "/admin/schedules" },
      { label: "Users", path: "/admin/users" },
      { label: "Logs", path: "/admin/logs" },
      { label: "Crawlers", path: "/admin/crawlers" },
      { label: "Stats", path: "/admin/stats" },
      { label: "API Keys", path: "/admin/api-keys", roles: ["dev"] },
      { label: "Messages", path: "/admin/messages", roles: ["dev"] },
    ],
  },
  {
    label: "Housing Database",
    path: "/hhdb",
    icon: Building2,
    roles: ["internal", "admin", "dev"],
    universes: ["UHERO"],
    location: "rail",
  },
  {
    label: "Docs",
    path: "/docs",
    icon: BookOpen,
    roles: ["internal", "admin", "dev"],
    location: "rail",
  },
];

/**
 * Check if a user with the given role+universe can access a route entry.
 */
export function canAccess(
  userRole: string,
  userUniverse: string,
  entry: { roles: Role[]; universes?: string[] },
): boolean {
  if (!entry.roles.includes(userRole as Role)) return false;
  if (
    entry.universes &&
    !entry.universes.includes(userUniverse.toUpperCase())
  ) {
    return false;
  }
  return true;
}

/**
 * Filter the route manifest for a given role+universe.
 * Returns entries with children also filtered. Used by the sidebar.
 */
export function getVisibleRoutes(
  userRole: string,
  userUniverse: string,
): RouteEntry[] {
  return ROUTES.flatMap((entry) => {
    if (!canAccess(userRole, userUniverse, entry)) return [];

    if (entry.children) {
      const filteredChildren = entry.children.filter((child) =>
        canAccess(userRole, userUniverse, {
          roles: child.roles ?? entry.roles,
          universes: child.universes ?? entry.universes,
        }),
      );
      // If no children are visible, still show the parent (it may have its own page)
      return [
        {
          ...entry,
          children: filteredChildren.length > 0 ? filteredChildren : undefined,
        },
      ];
    }

    return [entry];
  });
}

/**
 * Get visible children for a given parent path, filtered by role+universe.
 * Used by tab components to determine which tabs to render.
 */
export function getVisibleChildren(
  userRole: string,
  userUniverse: string,
  parentPath: string,
): RouteChild[] {
  const entry = ROUTES.find((r) => r.path === parentPath);
  if (!entry?.children) return [];

  return entry.children.filter((child) =>
    canAccess(userRole, userUniverse, {
      roles: child.roles ?? entry.roles,
      universes: child.universes ?? entry.universes,
    }),
  );
}

/**
 * Check if a pathname is allowed for a given role+universe.
 * Used by middleware for route enforcement.
 *
 * `pathname` is the full URL path, e.g. `/udaman/uhero/series`, `/admin/users`, `/hhdb`.
 *
 * The `universes` scoping on routes is checked against the universe segment of
 * the URL (current context), not the user's session universe. This lets a
 * UHERO dev user who has switched to HHF see HHF-scoped routes.
 */
export function isRouteAllowed(
  userRole: string,
  userUniverse: string,
  pathname: string,
): boolean {
  // ── Top-level routes: /admin/..., /hhdb/..., /docs/... ──
  const topLevelPrefixes = ["/admin", "/hhdb", "/docs"];
  for (const prefix of topLevelPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      for (const entry of ROUTES) {
        if (entry.path !== prefix) continue;

        // Check children for more specific matches first
        if (entry.children) {
          const sorted = [...entry.children].sort(
            (a, b) => b.path.length - a.path.length,
          );
          for (const child of sorted) {
            if (
              pathname === child.path ||
              pathname.startsWith(child.path + "/")
            ) {
              const childAccess = canAccess(userRole, userUniverse, {
                roles: child.roles ?? entry.roles,
                universes: child.universes ?? entry.universes,
              });
              return childAccess;
            }
          }
        }

        return canAccess(userRole, userUniverse, entry);
      }
      // No matching route found for this top-level prefix
      return false;
    }
  }

  // ── /udaman/{universe}/... routes ──
  const uniPrefixMatch = pathname.match(/^\/udaman\/([^/]+)(\/.*)?$/);
  if (!uniPrefixMatch) return true; // Not a udaman route — allow

  const urlUniverse = uniPrefixMatch[1].toUpperCase();
  const routePath = uniPrefixMatch[2] ?? "/"; // e.g. "/series", "/uploads/econ"

  // The universe homepage is always allowed
  if (routePath === "/" || routePath === "") return true;

  for (const entry of ROUTES) {
    // Skip rail routes — they're handled above as top-level
    if (entry.location === "rail") continue;

    // Relative paths — match against route-relative path
    if (routePath === entry.path || routePath.startsWith(entry.path + "/")) {
      // Check children first for more specific matches
      if (entry.children) {
        for (const child of entry.children) {
          if (
            routePath === child.path ||
            routePath.startsWith(child.path + "/")
          ) {
            const childAccess = canAccess(userRole, urlUniverse, {
              roles: child.roles ?? entry.roles,
              universes: child.universes ?? entry.universes,
            });
            if (childAccess) return true;
            // Child matched but access denied — don't fall through to parent
            return false;
          }
        }
      }

      if (canAccess(userRole, urlUniverse, entry)) return true;
    }
  }

  // No matching route found — deny by default
  return false;
}
