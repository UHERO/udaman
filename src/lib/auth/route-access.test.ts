import { describe, expect, test } from "bun:test";

import {
  FULL_ACCESS_ROLES,
  hasFullAccess,
  NEW_USER_ROLE,
  normalizeUniverse,
  sameUniverse,
} from "./roles";
import {
  canAccess,
  getLandingPath,
  getVisibleChildren,
  getVisibleRoutes,
  isRouteAllowed,
  ROUTES,
  toReadableSet,
} from "./route-access";

const LIMITED_ROLES = ["internal", "fellow", "fsonly", "external"] as const;

/** Every concrete page path the manifest knows about, as a full URL path. */
function allPaths(): string[] {
  const out: string[] = [];
  for (const entry of ROUTES) {
    const base = entry.location === "rail" ? "" : "/udaman/uhero";
    out.push(base + entry.path);
    for (const child of entry.children ?? []) out.push(base + child.path);
  }
  return out;
}

describe("roles", () => {
  test("only admin and dev have full access", () => {
    expect([...FULL_ACCESS_ROLES].sort()).toEqual(["admin", "dev"]);
    expect(hasFullAccess("admin")).toBe(true);
    expect(hasFullAccess("dev")).toBe(true);
    for (const role of LIMITED_ROLES) expect(hasFullAccess(role)).toBe(false);
  });

  test("new accounts start as the limited internal role", () => {
    expect(NEW_USER_ROLE).toBe("internal");
    expect(hasFullAccess(NEW_USER_ROLE)).toBe(false);
  });
});

describe("sidebar visibility", () => {
  test("a new (internal) user sees only the Comms rail app", () => {
    expect(getVisibleRoutes("internal", "UHERO").map((r) => r.path)).toEqual([
      "/comms",
    ]);
    expect(getVisibleChildren("internal", "UHERO", "/admin")).toEqual([]);
    expect(getVisibleChildren("internal", "UHERO", "/uploads")).toEqual([]);
  });

  test("fsonly users see nothing in the sidebar either", () => {
    expect(getVisibleRoutes("fsonly", "UHERO")).toEqual([]);
  });

  test("admin and dev see every non-universe-scoped entry", () => {
    const unscoped = ROUTES.filter((r) => !r.universes).map((r) => r.path);
    for (const role of FULL_ACCESS_ROLES) {
      const visible = getVisibleRoutes(role, "UHERO").map((r) => r.path);
      for (const path of unscoped) expect(visible).toContain(path);
    }
  });

  test("dev-only admin children stay hidden from admins", () => {
    const admin = getVisibleChildren("admin", "UHERO", "/admin").map(
      (c) => c.path,
    );
    expect(admin).not.toContain("/admin/api-keys");
    expect(admin).not.toContain("/admin/messages");
    const dev = getVisibleChildren("dev", "UHERO", "/admin").map((c) => c.path);
    expect(dev).toContain("/admin/api-keys");
  });

  test("fellows see exactly the Housing Database, Comms, and Registry apps", () => {
    const visible = getVisibleRoutes("fellow", "UHERO");
    expect(visible.map((r) => r.path).sort()).toEqual(
      ["/comms", "/data-registry", "/hhdb"].sort(),
    );
    expect(visible.every((r) => r.location === "rail")).toBe(true);
  });

  test("every top-level entry owns a distinct permission resource", () => {
    const resources = ROUTES.map((r) => r.resource);
    expect(new Set(resources).size).toBe(resources.length);
    for (const r of resources) expect(r).toMatch(/^[a-z-]+$/);
  });

  test("DBEDT external uploaders keep only the Econ and Tour upload pages", () => {
    const visible = getVisibleRoutes("external", "DBEDT");
    expect(visible.map((r) => r.path)).toEqual(["/uploads"]);
    expect(visible[0].children?.map((c) => c.path)).toEqual([
      "/uploads/econ",
      "/uploads/tour",
    ]);
  });
});

describe("route enforcement (middleware)", () => {
  test("internal users are denied every manifest path except Comms", () => {
    for (const path of allPaths()) {
      const isComms = path === "/comms" || path.startsWith("/comms/");
      expect(isRouteAllowed("internal", "UHERO", path)).toBe(isComms);
    }
  });

  test("the universe homepage is always reachable", () => {
    for (const role of [...LIMITED_ROLES, ...FULL_ACCESS_ROLES]) {
      expect(isRouteAllowed(role, "UHERO", "/udaman/uhero")).toBe(true);
      expect(isRouteAllowed(role, "UHERO", "/udaman/uhero/")).toBe(true);
    }
  });

  test("what a role can see is exactly what it can open", () => {
    // Visibility (sidebar) and reachability (middleware) must never drift:
    // a hidden item is unreachable and a visible one always opens.
    for (const role of [...FULL_ACCESS_ROLES, ...LIMITED_ROLES]) {
      for (const entry of ROUTES) {
        const base = entry.location === "rail" ? "" : "/udaman/uhero";
        expect(isRouteAllowed(role, "UHERO", base + entry.path)).toBe(
          canAccess(role, "UHERO", entry),
        );
        for (const child of entry.children ?? []) {
          expect(isRouteAllowed(role, "UHERO", base + child.path)).toBe(
            canAccess(role, "UHERO", {
              roles: child.roles ?? entry.roles,
              universes: child.universes ?? entry.universes,
            }),
          );
        }
      }
    }
  });

  test("universe-scoped routes are checked against the URL universe", () => {
    expect(
      isRouteAllowed("admin", "UHERO", "/udaman/hhf/uploads/factbook"),
    ).toBe(true);
    expect(
      isRouteAllowed("admin", "UHERO", "/udaman/uhero/uploads/factbook"),
    ).toBe(false);
  });

  test("nested paths inherit the entry's policy", () => {
    expect(isRouteAllowed("internal", "UHERO", "/udaman/uhero/series/42")).toBe(
      false,
    );
    expect(isRouteAllowed("admin", "UHERO", "/udaman/uhero/series/42")).toBe(
      true,
    );
    expect(isRouteAllowed("internal", "UHERO", "/hhdb/tables/parcels")).toBe(
      false,
    );
    expect(isRouteAllowed("internal", "UHERO", "/admin/users")).toBe(false);
  });

  test("fellows can open their three apps and nothing under /udaman", () => {
    expect(isRouteAllowed("fellow", "UHERO", "/hhdb/tables/parcels")).toBe(
      true,
    );
    expect(isRouteAllowed("fellow", "UHERO", "/comms/pub-form/new")).toBe(true);
    expect(isRouteAllowed("fellow", "UHERO", "/data-registry")).toBe(true);
    expect(isRouteAllowed("fellow", "UHERO", "/admin")).toBe(false);
    expect(isRouteAllowed("fellow", "UHERO", "/docs")).toBe(false);
    expect(isRouteAllowed("fellow", "UHERO", "/udaman/uhero/series")).toBe(
      false,
    );
  });

  test("DBEDT external users reach Econ/Tour uploads but not Forecast", () => {
    expect(
      isRouteAllowed("external", "DBEDT", "/udaman/dbedt/uploads/econ"),
    ).toBe(true);
    expect(
      isRouteAllowed("external", "DBEDT", "/udaman/dbedt/uploads/tour"),
    ).toBe(true);
    expect(
      isRouteAllowed("external", "DBEDT", "/udaman/dbedt/uploads/forecast"),
    ).toBe(false);
    expect(isRouteAllowed("external", "DBEDT", "/udaman/dbedt/series")).toBe(
      false,
    );
  });
});

describe("getLandingPath", () => {
  test("admin/dev land on Time Series", () => {
    expect(getLandingPath("admin", "UHERO")).toBe("/udaman/uhero/series");
    expect(getLandingPath("dev", "HHF")).toBe("/udaman/hhf/series");
  });

  test("limited roles land on the universe homepage, never a bounced page", () => {
    for (const role of LIMITED_ROLES) {
      const path = getLandingPath(role, "UHERO");
      expect(path).toBe("/udaman/uhero");
      expect(isRouteAllowed(role, "UHERO", path)).toBe(true);
    }
    expect(getLandingPath("external", "DBEDT")).toBe("/udaman/dbedt");
  });
});

describe("permission-driven access", () => {
  const readAll = toReadableSet(ROUTES.map((e) => e.resource));

  test("a read grant opens a route the manifest roles do not", () => {
    const series = ROUTES.find((e) => e.resource === "series")!;
    // Manifest alone: internal is locked out.
    expect(canAccess("internal", "UHERO", series)).toBe(false);
    expect(isRouteAllowed("internal", "UHERO", "/udaman/uhero/series")).toBe(
      false,
    );
    // With a read grant: open.
    expect(canAccess("internal", "UHERO", series, readAll)).toBe(true);
    expect(
      isRouteAllowed("internal", "UHERO", "/udaman/uhero/series", readAll),
    ).toBe(true);
  });

  test("omitting the grant falls back to the manifest, so old JWTs keep working", () => {
    expect(getVisibleRoutes("internal", "UHERO", undefined)).toEqual(
      getVisibleRoutes("internal", "UHERO"),
    );
    expect(getVisibleRoutes("admin", "UHERO", undefined).length).toBe(
      ROUTES.length,
    );
  });

  test("a grant never removes access the manifest already gave", () => {
    for (const role of ["admin", "dev", ...LIMITED_ROLES]) {
      for (const path of allPaths()) {
        if (isRouteAllowed(role, "UHERO", path)) {
          expect(isRouteAllowed(role, "UHERO", path, readAll)).toBe(true);
        }
      }
    }
  });

  test("children that declare their own roles stay narrow", () => {
    // /admin/api-keys and /admin/messages are dev-only; a read grant on the
    // parent `admin` resource must not widen them.
    for (const path of ["/admin/api-keys", "/admin/messages"]) {
      expect(isRouteAllowed("dev", "UHERO", path, readAll)).toBe(true);
      expect(isRouteAllowed("internal", "UHERO", path, readAll)).toBe(false);
      expect(isRouteAllowed("admin", "UHERO", path, readAll)).toBe(false);
    }
  });

  test("universe scoping is not overridable by a permission grant", () => {
    const hhdb = ROUTES.find((e) => e.resource === "hhdb")!;
    expect(hhdb.universes).toContain("UHERO");
    expect(canAccess("internal", "DBEDT", hhdb, readAll)).toBe(false);
  });
});

describe("universe case-insensitivity", () => {
  const readAll = toReadableSet(ROUTES.map((e) => e.resource));

  test("route checks treat uhero and UHERO as the same universe", () => {
    for (const u of ["UHERO", "uhero", "Uhero", " uhero "]) {
      expect(
        isRouteAllowed("internal", u, "/udaman/uhero/series", readAll),
      ).toBe(true);
      expect(getLandingPath("internal", u, readAll)).toBe(
        "/udaman/uhero/series",
      );
    }
  });

  test("universe scoping matches regardless of case", () => {
    const hhdb = ROUTES.find((e) => e.resource === "hhdb")!;
    for (const u of ["UHERO", "uhero"]) {
      expect(canAccess("dev", u, hhdb)).toBe(true);
    }
  });

  test("normalizeUniverse canonicalizes to uppercase", () => {
    expect(normalizeUniverse("uhero")).toBe("UHERO");
    expect(normalizeUniverse(" UHero ")).toBe("UHERO");
    expect(normalizeUniverse(null)).toBe("");
    expect(sameUniverse("uhero", "UHERO")).toBe(true);
    expect(sameUniverse("uhero", "dbedt")).toBe(false);
  });
});
