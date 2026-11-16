/** Catalog MCP: series and the lookup tables their metadata points at. */

import "server-only";

import LoaderCollection from "@catalog/collections/loader-collection";
import { mysql, rawQuery } from "@database/mysql";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { UNIVERSE as U, wrap, type CallerContext } from "../shared";

const OPS_UNIVERSE = U;

async function seriesDetail(idOrName: string | number) {
  const rows =
    typeof idOrName === "number"
      ? await mysql`SELECT * FROM series WHERE id = ${idOrName} LIMIT 1`
      : await mysql`SELECT * FROM series WHERE name = ${idOrName} AND universe = ${OPS_UNIVERSE} LIMIT 1`;
  const s = rows[0];
  if (!s) throw new Error(`Series ${idOrName} not found`);
  const [source, detail, unit, geo] = await Promise.all([
    s.source_id
      ? mysql`SELECT id, description, link FROM sources WHERE id = ${s.source_id}`
      : Promise.resolve([]),
    s.source_detail_id
      ? mysql`SELECT id, description FROM source_details WHERE id = ${s.source_detail_id}`
      : Promise.resolve([]),
    s.unit_id
      ? mysql`SELECT id, short_label, long_label FROM units WHERE id = ${s.unit_id}`
      : Promise.resolve([]),
    s.geography_id
      ? mysql`SELECT id, handle, display_name FROM geographies WHERE id = ${s.geography_id}`
      : Promise.resolve([]),
  ]);
  const loaders = await LoaderCollection.getBySeriesId(Number(s.id));
  const prefix = String(s.name ?? "").split("@")[0];
  const siblings = prefix
    ? await mysql`
        SELECT id, name, dataPortalName, source_id, source_detail_id, unit_id,
               geography_id, source_link, LEFT(description, 200) AS description
        FROM series
        WHERE universe = ${s.universe} AND name LIKE ${`${prefix}@%`} AND id <> ${s.id}
        ORDER BY name LIMIT 25`
    : [];
  const measurements = await mysql`
    SELECT m.id, m.prefix, m.data_portal_name AS dataPortalName, m.source_id,
           m.unit_id, m.source_detail_id, m.source_link,
           EXISTS (SELECT 1 FROM data_list_measurements dlm
                   WHERE dlm.measurement_id = m.id) AS in_data_list
    FROM measurement_series ms JOIN measurements m ON m.id = ms.measurement_id
    WHERE ms.series_id = ${s.id}
  `;
  const dependents = await mysql`
    SELECT ds.id AS loader_id, se.name
    FROM data_sources ds JOIN series se ON se.id = ds.series_id
    WHERE ds.universe = ${s.universe} AND ds.disabled = 0
      AND ds.eval LIKE ${`%"${s.name}"%`}
    LIMIT 25
  `;
  return {
    series: {
      id: Number(s.id),
      name: s.name,
      universe: s.universe,
      dataPortalName: s.dataPortalName,
      description: s.description,
      source_link: s.source_link,
      source: source[0] ?? null,
      source_detail: detail[0] ?? null,
      unit: unit[0] ?? null,
      geography: geo[0] ?? null,
      investigation_notes: s.investigation_notes ?? null,
    },
    // The portal shows the series value, else the measurement's.
    measurements,
    loaders: loaders.map((l) => ({
      id: l.id,
      eval: l.eval,
      priority: l.priority,
      disabled: l.disabled,
      lastRunAt: l.lastRunAt,
      lastError: l.lastError,
    })),
    siblingsSameNamePrefix: siblings,
    usedByLoadersOf: dependents,
  };
}

const LOOKUPS = {
  sources: {
    table: "sources",
    cols: "id, description, link",
    search: "description",
  },
  source_details: {
    table: "source_details",
    cols: "id, description",
    search: "description",
  },
  units: {
    table: "units",
    cols: "id, short_label, long_label",
    search: "long_label",
  },
  geographies: {
    table: "geographies",
    cols: "id, handle, display_name",
    search: "display_name",
  },
} as const;

export function registerSeriesTools(server: McpServer, _ctx: CallerContext) {
  server.registerTool(
    "get_series",
    {
      title: "Get a series",
      description:
        "Series metadata (source, source detail, unit, geography, portal name, description, link), the measurements it belongs to with their own metadata, its loaders, sibling series with the same name prefix, and loaders that reference it.",
      inputSchema: {
        id: z.number().int().optional(),
        name: z.string().optional().describe("Series name like VISNS@HI.M"),
      },
    },
    wrap(async ({ id, name }: { id?: number; name?: string }) => {
      if (id == null && !name) throw new Error("Give id or name");
      return seriesDetail(id ?? name!);
    }),
  );

  server.registerTool(
    "find_series",
    {
      title: "Find series",
      description:
        "Search UHERO series by name pattern (SQL LIKE, e.g. 'VIS%@HI.M') or portal-name substring. Returns metadata ids so you can compare related series.",
      inputSchema: {
        name_like: z.string().optional(),
        portal_name_contains: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    wrap(
      async (a: {
        name_like?: string;
        portal_name_contains?: string;
        limit?: number;
      }) => {
        if (!a.name_like && !a.portal_name_contains)
          throw new Error("Give name_like or portal_name_contains");
        const where = ["universe = ?"];
        const params: (string | number)[] = [U];
        if (a.name_like) {
          where.push("name LIKE ?");
          params.push(a.name_like);
        }
        if (a.portal_name_contains) {
          where.push("dataPortalName LIKE ?");
          params.push(`%${a.portal_name_contains}%`);
        }
        return rawQuery(
          `SELECT id, name, dataPortalName, source_id, source_detail_id, unit_id, geography_id, source_link
         FROM series WHERE ${where.join(" AND ")} ORDER BY name LIMIT ${a.limit ?? 30}`,
          params,
        );
      },
    ),
  );

  server.registerTool(
    "list_lookup",
    {
      title: "List valid metadata values",
      description:
        "Rows of a lookup table (sources, source_details, units, geographies) in UHERO, optionally filtered by text. Use these ids in metadata proposals.",
      inputSchema: {
        table: z.enum(["sources", "source_details", "units", "geographies"]),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    wrap(
      async ({
        table,
        search,
        limit,
      }: {
        table: keyof typeof LOOKUPS;
        search?: string;
        limit?: number;
      }) => {
        const spec = LOOKUPS[table];
        const params: (string | number)[] = [U];
        let filter = "";
        if (search) {
          filter = ` AND ${spec.search} LIKE ?`;
          params.push(`%${search}%`);
        }
        return rawQuery(
          `SELECT ${spec.cols} FROM ${spec.table} WHERE universe = ?${filter} ORDER BY id LIMIT ${limit ?? 50}`,
          params,
        );
      },
    ),
  );
}
