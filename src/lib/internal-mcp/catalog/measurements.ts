/** Catalog MCP: measurements (the level most metadata belongs on). */

import "server-only";

import { mysql } from "@database/mysql";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { UNIVERSE as OPS_UNIVERSE, wrap, type CallerContext } from "../shared";

async function measurementDetail(id: number) {
  const rows = await mysql`
    SELECT m.id, m.prefix, m.universe, m.data_portal_name AS dataPortalName,
           m.source_id, src.description AS source, m.unit_id,
           u.short_label AS unit_short, u.long_label AS unit_long,
           m.source_detail_id, sd.description AS source_detail, m.source_link,
           m.seasonal_adjustment, m.percent, m.real, m.notes
    FROM measurements m
    LEFT JOIN sources src ON src.id = m.source_id
    LEFT JOIN units u ON u.id = m.unit_id
    LEFT JOIN source_details sd ON sd.id = m.source_detail_id
    WHERE m.id = ${id} AND m.universe = ${OPS_UNIVERSE} LIMIT 1
  `;
  if (!rows[0]) throw new Error(`Measurement ${id} not found`);
  const [series, dataLists] = await Promise.all([
    mysql`
      SELECT s.id, s.name, s.dataPortalName, s.source_id,
             src.description AS source, s.unit_id, u.short_label AS unit,
             s.source_detail_id, s.source_link, s.seasonal_adjustment
      FROM measurement_series ms
      JOIN series s ON s.id = ms.series_id
      LEFT JOIN sources src ON src.id = s.source_id
      LEFT JOIN units u ON u.id = s.unit_id
      WHERE ms.measurement_id = ${id}
      ORDER BY s.name LIMIT 300`,
    mysql`
      SELECT dl.id, dl.name FROM data_list_measurements dlm
      JOIN data_lists dl ON dl.id = dlm.data_list_id
      WHERE dlm.measurement_id = ${id}`,
  ]);
  return {
    measurement: rows[0],
    note: "The portal shows a series' own value and falls back to the measurement's. A series has a gap only when both are empty.",
    series,
    dataLists,
  };
}

export function registerMeasurementTools(
  server: McpServer,
  _ctx: CallerContext,
) {
  server.registerTool(
    "get_measurement",
    {
      title: "Get a measurement",
      description:
        "A measurement's own metadata (source, unit, source detail, portal name, link), every series in it with that series' own metadata, and the data lists it is in. Use it to decide whether a missing value belongs on the measurement (the series are the same measure) or on individual series (they legitimately differ).",
      inputSchema: { id: z.number().int() },
    },
    wrap(async ({ id }: { id: number }) => measurementDetail(id)),
  );
}
