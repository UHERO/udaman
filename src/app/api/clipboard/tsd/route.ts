import { getCurrentUserId } from "@/lib/auth";
import { scopedConnection } from "@/lib/mysql/db";
import ClipboardCollection from "@catalog/collections/clipboard-collection";
import { seriesToTsd } from "@catalog/utils/tsd-generator";
import type { TsdFrequency } from "@catalog/utils/tsd-generator";

const MAX_SERIES = 500;
const BATCH_SIZE = 50;

export async function GET() {
  const userId = await getCurrentUserId();

  const seriesList = await ClipboardCollection.getSeriesExportInfo(userId);
  if (seriesList.length === 0) {
    return new Response("Clipboard is empty", { status: 400 });
  }
  if (seriesList.length > MAX_SERIES) {
    return new Response(
      `Clipboard has ${seriesList.length} series — export is limited to ${MAX_SERIES}. Remove some series and try again.`,
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Process series in batches of BATCH_SIZE.
        // Each batch: create a temp table with date+value per xseries,
        // generate TSD output for each series in the batch, then drop the table.
        for (let i = 0; i < seriesList.length; i += BATCH_SIZE) {
          const batch = seriesList.slice(i, i + BATCH_SIZE);
          const xsIds = batch.map((s) => Number(s.xseriesId)).join(",");

          await scopedConnection(async (exec) => {
            await exec(`
              CREATE TEMPORARY TABLE tsd_batch AS
              SELECT xseries_id, DATE_FORMAT(date, '%Y-%m-%d') AS d, value
              FROM data_points
              WHERE xseries_id IN (${xsIds}) AND current = 1
              ORDER BY xseries_id, date
            `);

            for (const series of batch) {
              const rows = await exec(
                `SELECT d, value FROM tsd_batch WHERE xseries_id = ${Number(series.xseriesId)} ORDER BY d`,
              );

              const data = new Map<string, number>();
              for (const row of rows) {
                const r = row as Record<string, unknown>;
                if (r.value != null) {
                  data.set(r.d as string, Number(r.value));
                }
              }

              if (data.size > 0) {
                const tsd = seriesToTsd({
                  name: series.name,
                  data,
                  frequency: (series.frequency ?? "month") as TsdFrequency,
                });
                controller.enqueue(encoder.encode(tsd));
              }
            }

            await exec("DROP TEMPORARY TABLE IF EXISTS tsd_batch");
          });
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="clipboard-export.tsd"`,
    },
  });
}
