import { getCurrentUserId } from "@/lib/auth";
import { scopedConnection } from "@/lib/mysql/db";
import ClipboardCollection from "@catalog/collections/clipboard-collection";

const MAX_SERIES = 500;
const ROW_BATCH = 500;

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
        // All queries run inside a single scoped connection so the
        // temporary table is visible across CREATE → SELECT → DROP.
        await scopedConnection(async (exec) => {
          // Build the dynamic pivot columns:
          //   MAX(CASE WHEN xseries_id = 123 THEN value END) AS c0,
          //   MAX(CASE WHEN xseries_id = 456 THEN value END) AS c1, ...
          // We use positional aliases (c0, c1, ...) to avoid quoting issues
          // with series names; the real names go in the CSV header.
          const pivotCols = seriesList
            .map(
              (s, i) =>
                `MAX(CASE WHEN xseries_id = ${Number(s.xseriesId)} THEN value END) AS c${i}`,
            )
            .join(", ");

          const xsIds = seriesList.map((s) => Number(s.xseriesId)).join(",");

          await exec(`
            CREATE TEMPORARY TABLE clipboard_export AS
            SELECT
              DATE_FORMAT(date, '%Y-%m-%d') AS d,
              ${pivotCols}
            FROM data_points
            WHERE xseries_id IN (${xsIds}) AND current = 1
            GROUP BY date
            ORDER BY date
          `);

          // Get total row count
          const countRows = await exec(
            "SELECT COUNT(*) AS cnt FROM clipboard_export",
          );
          const total = Number(countRows[0].cnt);

          // Write CSV header (real series names)
          const header =
            ["Date", ...seriesList.map((s) => s.name)].join(",") + "\n";
          controller.enqueue(encoder.encode(header));

          // Stream rows in batches
          for (let offset = 0; offset < total; offset += ROW_BATCH) {
            const rows = await exec(
              `SELECT * FROM clipboard_export ORDER BY d LIMIT ${ROW_BATCH} OFFSET ${offset}`,
            );

            let chunk = "";
            for (const row of rows) {
              const r = row as Record<string, unknown>;
              const values = seriesList.map((_, i) => {
                const v = r[`c${i}`];
                return v != null ? String(v) : "";
              });
              chunk += r.d + "," + values.join(",") + "\n";
            }
            controller.enqueue(encoder.encode(chunk));
          }

          await exec("DROP TEMPORARY TABLE IF EXISTS clipboard_export");
        });

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="clipboard-export.csv"`,
    },
  });
}
