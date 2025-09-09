import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeriesById } from "@/actions/series-actions";
import { Clock } from "lucide-react";

import { MetaDataTable, SeriesDataTable } from "@/components/series/tables";

/* Metadata
{
   id: 400625,
   xseries_id: 400625,
   geography_id: 6378,
   unit_id: 6477,
   source_id: 7576,
   source_detail_id: null,
   universe: 'NTA',
   decimals: 2,
   name: 'NTA_LSR@CPV.A',
   dataPortalName: 'Longitudinal support ratio',
   description: null,
   created_at: '2023-12-01T17:45:17.000Z',
   updated_at: '2023-12-01T17:45:17.000Z',
   dependency_depth: 0,
   source_link: null,
   investigation_notes: null,
   scratch: 0,
   primary_series_id: 405962,
   restricted: 0,
   quarantined: 0,
   frequency: 'year',
   seasonally_adjusted: null,
   seasonal_adjustment: 'not_applicable',
   aremos_missing: null,
   aremos_diff: null,
   mult: null,
   units: 1,
   percent: 0,
   real: null,
   base_year: null,
   frequency_transform: null,
   last_demetra_date: null,
   last_demetra_datestring: null,
   factor_application: null,
   factors: null,
   geo_handle: 'CPV',
   geo_display_name: 'Cabo Verde',
   unit_short: 'Percent',
   unit_long: 'Percent',
   source_description: 'Longitudinal support ratio (Mason, Lee et al. 2017)',
   source_detail_description: null
} */

export default async function SeriesPage({
  params,
}: {
  params: { id: number };
}) {
  const { id } = await params;
  const { error, data } = await getSeriesById(id);
  if (error) throw error;
  if (!data) notFound();

  const { dataPoints, metadata, measurement, aliases } = data;
  console.log("Data Points", dataPoints);
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4 rounded">
        <MetaDataTable metadata={{ ...metadata, measurement, aliases }} />
      </div>
      <div className="col-span-6 rounded border">
        {" "}
        <h2 className="text-4xl">Data Points</h2>
        <div>
          <LoaderSection />
          <SeriesDataTable data={dataPoints} />
        </div>
      </div>
      {/* <div className="bg-muted col-span-2 rounded border"></div> */}
    </div>
  );
}

/* Metadata
{
   id: 400625,
   xseries_id: 400625,
   geography_id: 6378,
   unit_id: 6477,
   source_id: 7576,
   source_detail_id: null,
   universe: 'NTA',
   decimals: 2,
   name: 'NTA_LSR@CPV.A',
   dataPortalName: 'Longitudinal support ratio',
   description: null,
   created_at: '2023-12-01T17:45:17.000Z',
   updated_at: '2023-12-01T17:45:17.000Z',
   dependency_depth: 0,
   source_link: null,
   investigation_notes: null,
   scratch: 0,
   primary_series_id: 405962,
   restricted: 0,
   quarantined: 0,
   frequency: 'year',
   seasonally_adjusted: null,
   seasonal_adjustment: 'not_applicable',
   aremos_missing: null,
   aremos_diff: null,
   mult: null,
   units: 1,
   percent: 0,
   real: null,
   base_year: null,
   frequency_transform: null,
   last_demetra_date: null,
   last_demetra_datestring: null,
   factor_application: null,
   factors: null,
   geo_handle: 'CPV',
   geo_display_name: 'Cabo Verde',
   unit_short: 'Percent',
   unit_long: 'Percent',
   source_description: 'Longitudinal support ratio (Mason, Lee et al. 2017)',
   source_detail_description: null
} */

const LoaderSection = () => {
  const actions = [
    { action: "load", url: "#" },
    { action: "clear", url: "#" },
    { action: "delete", url: "#" },
    { action: "disable", url: "#" },
    { action: "edit", url: "#" },
    { action: "toggle nightly load", url: "#" },
  ];
  const bulkActions = [
    { action: "new", url: "#" },
    { action: "clear data", url: "#" },
    { action: "load all", url: "#" },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-row justify-start font-semibold">
        <span className="mr-4">Loaders</span>(
        {bulkActions.map((m, i) => (
          <div key={`bulk-action-${i}`}>
            <Link href={m.url} className="px-2">
              {m.action}
            </Link>
            {i !== bulkActions.length - 1 ? "|" : ""}
          </div>
        ))}
        )
      </div>
      <div className="borderl-0 border border-r-0 bg-amber-100 p-2">
        <div className="flex flex-row items-center justify-evenly">
          <span className="text-xs">MM/DD/YY</span>
          <span className="text-primary/80 text-xs">HH:MM</span>
          <span className="text-xs">(priority)</span>
          {actions.map((m, i) => (
            <div key={`load-stmt-action-${i}`}>
              <Link href={m.url} className="text-xs">
                {m.action}
              </Link>
              {i !== bulkActions.length - 1 ? (
                <span className="text-xs">|</span>
              ) : (
                ""
              )}
            </div>
          ))}
          <span className="text-primary/80 text-xs">(1.09s)</span>
        </div>
        <div>
          <span className="my-3 flex py-2 font-semibold">
            NNNNNNN <Clock className="ml-2 p-0.5" />
          </span>
        </div>
        <div>
          <span className="font-semibold">Scale:</span> 0.001
        </div>
        <div>
          <div>{"Loaded from {source}"}</div>
          <div>{"{load statement}"}</div>
        </div>
      </div>
    </div>
  );
};
