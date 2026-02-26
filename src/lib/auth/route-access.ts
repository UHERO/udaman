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
  ChartLine,
  FileSpreadsheet,
  Globe,
  SearchSlash,
  Settings,
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
};

/**
 * Master route manifest. Paths are relative to `/udaman/{universe}`
 * unless they start with `/udaman/` (absolute within the app).
 */
export const ROUTES: RouteEntry[] = [
  {
    label: "Data Series",
    path: "/series",
    icon: TableProperties,
    roles: ["internal", "admin", "dev"],
    children: [
      { label: "List", path: "/series" },
      { label: "Analyze", path: "/series/analyze" },
      { label: "Compare", path: "/series/compare" },
      { label: "Calculate", path: "/series/calculate" },
      { label: "Clipboard", path: "/series/clipboard" },
      { label: "Missing Metadata", path: "/series/no-source" },
      { label: "Quarantine", path: "/series/quarantine" },
    ],
  },
  {
    label: "Catalog",
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
    label: "CSV-to-TSD",
    path: "/csv-to-tsd",
    icon: FileSpreadsheet,
    roles: ["internal", "admin", "dev"],
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
  },
  {
    label: "Admin",
    path: "/udaman/admin",
    icon: Shield,
    roles: ["admin", "dev"],
    children: [
      { label: "Permissions", path: "/udaman/admin" },
      { label: "Feature Toggles", path: "/udaman/admin/feature-toggles" },
      { label: "Workers", path: "/udaman/admin/workers" },
      { label: "Schedules", path: "/udaman/admin/schedules" },
      { label: "Users", path: "/udaman/admin/users" },
      { label: "Crawlers", path: "/udaman/admin/crawlers" },
    ],
  },
  {
    label: "Docs",
    path: "/docs",
    icon: BookOpen,
    roles: ["internal", "admin", "dev"],
  },
  {
    label: "Forecast Snapshots",
    path: "/forecast/snapshots",
    icon: BookOpen,
    roles: ["internal", "admin", "dev"],
  },
  {
    label: "Feature Toggles",
    path: "/feature-toggles",
    icon: Settings,
    roles: ["admin", "dev"],
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
    ],
  },
  {
    label: "Web Crawlers",
    path: "/udaman/admin/crawlers",
    icon: Globe,
    roles: ["admin", "dev"],
    children: [
      { label: "qPub", path: "/udaman/admin/crawlers/qpub" },
    ],
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
      return [{ ...entry, children: filteredChildren.length > 0 ? filteredChildren : undefined }];
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
 * `pathname` is the full URL path, e.g. `/udaman/uhero/series` or `/udaman/admin/investigations`.
 */
export function isRouteAllowed(
  userRole: string,
  userUniverse: string,
  pathname: string,
): boolean {
  // Strip the /udaman/{universe} prefix to get the route-relative path
  const uniPrefixMatch = pathname.match(/^\/udaman\/([^/]+)(\/.*)?$/);
  if (!uniPrefixMatch) return true; // Not a udaman route — allow

  const routePath = uniPrefixMatch[2] ?? "/"; // e.g. "/series", "/uploads/econ"

  // The universe homepage is always allowed
  if (routePath === "/" || routePath === "") return true;

  for (const entry of ROUTES) {
    // Absolute paths (e.g. /udaman/admin/investigations) — match against full pathname
    if (entry.path.startsWith("/udaman/")) {
      if (pathname === entry.path || pathname.startsWith(entry.path + "/")) {
        // Check children for more specific matches (longest path first)
        if (entry.children) {
          const sorted = [...entry.children].sort(
            (a, b) => b.path.length - a.path.length,
          );
          for (const child of sorted) {
            const childPath = child.path;
            if (pathname === childPath || pathname.startsWith(childPath + "/")) {
              const childAccess = canAccess(userRole, userUniverse, {
                roles: child.roles ?? entry.roles,
                universes: child.universes ?? entry.universes,
              });
              if (childAccess) return true;
              return false;
            }
          }
        }
        if (canAccess(userRole, userUniverse, entry)) return true;
      }
      continue;
    }

    // Relative paths — match against route-relative path
    if (routePath === entry.path || routePath.startsWith(entry.path + "/")) {
      // Check children first for more specific matches
      if (entry.children) {
        for (const child of entry.children) {
          if (
            routePath === child.path ||
            routePath.startsWith(child.path + "/")
          ) {
            const childAccess = canAccess(userRole, userUniverse, {
              roles: child.roles ?? entry.roles,
              universes: child.universes ?? entry.universes,
            });
            if (childAccess) return true;
            // Child matched but access denied — don't fall through to parent
            return false;
          }
        }
      }

      if (canAccess(userRole, userUniverse, entry)) return true;
    }
  }

  // No matching route found — deny by default
  return false;
}
