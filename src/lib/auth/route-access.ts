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
  Library,
  LineChart,
  Megaphone,
  SearchSlash,
  Shield,
  TableProperties,
  type LucideIcon,
} from "lucide-react";

import { FULL_ACCESS_ROLES, type Role } from "./roles";

export type { Role } from "./roles";

export type RouteChild = {
  label: string;
  path: string;
  roles?: readonly Role[];
  universes?: string[];
};

export type RouteEntry = {
  label: string;
  /**
   * Permission resource this item owns. The admin Permissions page shows a
   * CRUD row per top-level item keyed on this; finer-grained resources
   * checked by server actions roll up to it via RESOURCE_PARENTS.
   */
  resource: string;
  path: string;
  /**
   * Sidebar link target when it differs from `path` — for sections whose
   * index page only redirects to a default child. Linking straight to the
   * child avoids a server redirect inside a client-side navigation, which
   * bounces through the proxy prefix-strip and trips the error boundary.
   * `path` is still what access checks and active-state matching use.
   */
  href?: string;
  icon: LucideIcon;
  roles: readonly Role[];
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
 *
 * Access policy: every tool is admin/dev only (FULL_ACCESS_ROLES). The
 * `internal` role — which every auto-created Google account starts with —
 * sees an empty sidebar and can only reach the universe homepage until an
 * admin promotes it. Exceptions: Comms, where internal users file their own
 * pre-release forms; the DBEDT external upload flow (a deliberately narrow,
 * pre-existing workflow); and the `fellow` role, which gets the Housing
 * Database, Comms, and Registry rail apps by default.
 */
export const ROUTES: RouteEntry[] = [
  {
    label: "Time Series",
    resource: "series",
    path: "/series",
    icon: TableProperties,
    roles: FULL_ACCESS_ROLES,
  },
  {
    label: "Analyze",
    resource: "analyze",
    path: "/analyze",
    icon: LineChart,
    roles: FULL_ACCESS_ROLES,
  },
  {
    label: "Clipboard",
    resource: "clipboard",
    path: "/clipboard",
    icon: ClipboardList,
    roles: FULL_ACCESS_ROLES,
  },
  {
    label: "Data Portal Catalog",
    resource: "catalog",
    path: "/catalog",
    icon: ChartLine,
    roles: FULL_ACCESS_ROLES,
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
    resource: "data-tools",
    path: "/data-tools",
    href: "/data-tools/tsd",
    icon: FileSpreadsheet,
    roles: FULL_ACCESS_ROLES,
    children: [
      { label: "TSD Convert & Inspect", path: "/data-tools/tsd" },
      { label: "Timeline Events", path: "/data-tools/timeline" },
    ],
  },
  {
    label: "Investigations",
    resource: "investigation",
    path: "/investigations",
    icon: SearchSlash,
    roles: FULL_ACCESS_ROLES,
    children: [
      { label: "Dashboard", path: "/investigations" },
      { label: "Missing Metadata", path: "/investigations/no-source" },
      { label: "Quarantine", path: "/investigations/quarantine" },
    ],
  },
  {
    label: "Forecast Snapshots",
    resource: "forecast-snapshot",
    path: "/forecast/snapshots",
    icon: BookOpen,
    roles: FULL_ACCESS_ROLES,
  },
  {
    label: "Uploads",
    resource: "upload",
    path: "/uploads",
    href: "/uploads/econ",
    icon: ArrowUpToLine,
    // DBEDT external uploaders keep their Econ/Tour pages (see policy note).
    roles: ["external", ...FULL_ACCESS_ROLES],
    children: [
      {
        label: "Econ",
        path: "/uploads/econ",
        roles: ["external", ...FULL_ACCESS_ROLES],
      },
      {
        label: "Tour",
        path: "/uploads/tour",
        roles: ["external", ...FULL_ACCESS_ROLES],
      },
      {
        label: "Forecast",
        path: "/uploads/forecast",
        roles: FULL_ACCESS_ROLES,
      },
      {
        label: "Factbook",
        path: "/uploads/factbook",
        roles: FULL_ACCESS_ROLES,
        universes: ["HHF"],
      },
    ],
  },
  {
    label: "Downloads",
    resource: "download",
    path: "/downloads",
    icon: ArrowDownToLine,
    roles: FULL_ACCESS_ROLES,
  },
  {
    label: "Exports",
    resource: "export",
    path: "/exports",
    icon: ArrowLeftFromLine,
    roles: FULL_ACCESS_ROLES,
  },
  // ── Rail routes (top-level, absolute paths) ──
  {
    label: "Admin",
    resource: "admin",
    path: "/admin",
    icon: Shield,
    roles: FULL_ACCESS_ROLES,
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
      { label: "Performance", path: "/admin/perf" },
      { label: "API Keys", path: "/admin/api-keys", roles: ["dev"] },
      { label: "Messages", path: "/admin/messages", roles: ["dev"] },
    ],
  },
  {
    label: "Housing Database",
    resource: "hhdb",
    path: "/hhdb",
    icon: Building2,
    roles: ["fellow", ...FULL_ACCESS_ROLES],
    universes: ["UHERO"],
    location: "rail",
  },
  {
    label: "Comms",
    resource: "approval",
    path: "/comms",
    icon: Megaphone,
    // UHERO staff (internal) file their own pre-release forms too.
    roles: ["internal", "fellow", ...FULL_ACCESS_ROLES],
    location: "rail",
    children: [{ label: "New form", path: "/comms/pub-form/new" }],
  },
  {
    label: "Docs",
    resource: "docs",
    path: "/docs",
    icon: BookOpen,
    roles: FULL_ACCESS_ROLES,
    location: "rail",
  },
  {
    label: "Registry",
    resource: "data-registry",
    path: "/data-registry",
    icon: Library,
    roles: ["fellow", ...FULL_ACCESS_ROLES],
    location: "rail",
  },
];

/**
 * Check if a user with the given role+universe can access a route entry.
 */
export function canAccess(
  userRole: string,
  userUniverse: string,
  entry: { roles: readonly Role[]; universes?: string[] },
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
  const topLevelPrefixes = [
    "/admin",
    "/hhdb",
    "/docs",
    "/comms",
    "/data-registry",
  ];
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

/**
 * Resolve the landing page path for a role+universe after login.
 *
 * Users who can open the Time Series tool land there directly. Everyone
 * else — including freshly auto-created `internal` accounts and DBEDT
 * external uploaders — lands on the universe homepage, which renders cards
 * for whatever (if anything) their role can reach. Kept in sync with the
 * manifest by asking `isRouteAllowed`, so a policy change here can't leave
 * login redirecting into a page the middleware then bounces.
 */
export function getLandingPath(userRole: string, userUniverse: string): string {
  const u = userUniverse.toLowerCase();
  const seriesPath = `/udaman/${u}/series`;
  return isRouteAllowed(userRole, userUniverse, seriesPath)
    ? seriesPath
    : `/udaman/${u}`;
}
