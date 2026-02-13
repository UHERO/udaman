import { NextRequest } from "next/server";
import DataPointCollection from "@catalog/collections/data-point-collection";
import SeriesCollection from "@catalog/collections/series-collection";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return new Response("Invalid series ID", { status: 400 });
  }

  const metadata = await SeriesCollection.getSeriesMetadata({ id });
  const dataPoints = await DataPointCollection.getBySeriesId({
    xseriesId: metadata.xs_id,
  });

  const name = metadata.s_name ?? `series_${id}`;

  // Build CSV
  const header = "Date,Values,LVL,YOY,YTD\n";
  const rows = dataPoints.map((dp) => {
    const date =
      dp.date instanceof Date
        ? dp.date.toISOString().slice(0, 10)
        : String(dp.date);
    return [
      date,
      dp.value ?? "",
      dp.lvl_change ?? "",
      dp.yoy ?? "",
      dp.ytd ?? "",
    ].join(",");
  });

  const csv = header + rows.join("\n") + "\n";
  const fileName = `${name.replace(/[^a-zA-Z0-9_]/g, "-")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
