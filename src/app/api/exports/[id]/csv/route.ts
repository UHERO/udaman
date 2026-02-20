import ExportCollection from "@catalog/collections/export-collection";
import { scopedConnection } from "@/lib/mysql/db";

const ROW_BATCH = 500;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const exportId = parseInt(id);
  if (isNaN(exportId)) {
    return new Response("Invalid export ID", { status: 400 });
  }

  const exp = await ExportCollection.getById(exportId);
  const seriesList = await ExportCollection.getSeriesIdsForExport(exportId);

  if (seriesList.length === 0) {
    return new Response("Export has no series", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await scopedConnection(async (exec) => {
          const pivotCols = seriesList
            .map(
              (s, i) =>
                `MAX(CASE WHEN xseries_id = ${Number(s.xseriesId)} THEN value END) AS c${i}`,
            )
            .join(", ");

          const xsIds = seriesList.map((s) => Number(s.xseriesId)).join(",");

          await exec(`
            CREATE TEMPORARY TABLE export_csv AS
            SELECT
              DATE_FORMAT(date, '%Y-%m-%d') AS d,
              ${pivotCols}
            FROM data_points
            WHERE xseries_id IN (${xsIds}) AND current = 1
            GROUP BY date
            ORDER BY date
          `);

          const countRows = await exec(
            "SELECT COUNT(*) AS cnt FROM export_csv",
          );
          const total = Number(countRows[0].cnt);

          const header =
            ["Date", ...seriesList.map((s) => s.name)].join(",") + "\n";
          controller.enqueue(encoder.encode(header));

          for (let offset = 0; offset < total; offset += ROW_BATCH) {
            const rows = await exec(
              `SELECT * FROM export_csv ORDER BY d LIMIT ${ROW_BATCH} OFFSET ${offset}`,
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

          await exec("DROP TEMPORARY TABLE IF EXISTS export_csv");
        });

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  const filename = (exp.name ?? "export").replace(/[^a-zA-Z0-9_-]/g, "_");

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="export-${filename}.csv"`,
    },
  });
}
