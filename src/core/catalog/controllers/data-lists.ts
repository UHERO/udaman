import "server-only";
import { createLogger } from "@/core/observability/logger";

import DataListCollection from "../collections/data-list-collection";
import type {
  CreateDataListPayload,
  UpdateDataListPayload,
} from "../collections/data-list-collection";
import Series from "../models/series";
import type { SuperTableData, SuperTableSeriesEntry } from "../types/data-list-table";
import type { Universe } from "../types/shared";

const log = createLogger("catalog.data-lists");

/*************************************************************************
 * DATA LISTS Controller
 *************************************************************************/

export async function getDataLists({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching data lists");
  const data = await DataListCollection.list({ universe: u });
  log.info({ count: data.length }, "data lists fetched");
  return { data };
}

export async function getDataListsWithCounts({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching data lists with counts");
  const data = await DataListCollection.listWithCounts({ universe: u });
  log.info({ count: data.length }, "data lists with counts fetched");
  return { data };
}

export async function getDataList({ id }: { id: number }) {
  log.info({ id }, "fetching data list");
  const data = await DataListCollection.getById(id);
  return { data };
}

export async function getDataListMeasurements({ id }: { id: number }) {
  log.info({ id }, "fetching data list measurements");
  const data = await DataListCollection.getMeasurementIds(id);
  log.info({ count: data.length }, "data list measurements fetched");
  return { data };
}

export async function addDataListMeasurement({
  dataListId,
  measurementId,
  listOrder,
  indent,
}: {
  dataListId: number;
  measurementId: number;
  listOrder?: number;
  indent?: string;
}) {
  log.info({ dataListId, measurementId }, "adding measurement to data list");
  await DataListCollection.addMeasurement(
    dataListId,
    measurementId,
    listOrder,
    indent,
  );
  log.info({ dataListId, measurementId }, "measurement added to data list");
}

export async function removeDataListMeasurement({
  dataListId,
  measurementId,
}: {
  dataListId: number;
  measurementId: number;
}) {
  log.info(
    { dataListId, measurementId },
    "removing measurement from data list",
  );
  await DataListCollection.removeMeasurement(dataListId, measurementId);
  log.info({ dataListId, measurementId }, "measurement removed from data list");
}

export async function createDataList({
  payload,
}: {
  payload: CreateDataListPayload;
}) {
  log.info({ payload }, "creating data list");
  const data = await DataListCollection.create(payload);
  log.info({ id: data.id }, "data list created");
  return { message: "Data list created", data };
}

export async function updateDataList({
  id,
  payload,
}: {
  id: number;
  payload: UpdateDataListPayload;
}) {
  log.info({ id, payload }, "updating data list");
  const data = await DataListCollection.update(id, payload);
  log.info({ id }, "data list updated");
  return { message: "Data list updated", data };
}

export async function deleteDataList({ id }: { id: number }) {
  log.info({ id }, "deleting data list");
  await DataListCollection.delete(id);
  log.info({ id }, "data list deleted");
  return { message: "Data list deleted" };
}

export async function getDataListForEdit({ id }: { id: number }) {
  log.info({ id }, "fetching data list for edit");
  const [dataList, measurements, users] = await Promise.all([
    DataListCollection.getById(id),
    DataListCollection.getMeasurementsForEdit(id),
    DataListCollection.listUsers(),
  ]);
  const ownerEmail = await DataListCollection.getOwnerEmail(dataList.ownedBy);
  return { dataList, measurements, ownerEmail, users };
}

export async function moveMeasurement({
  dataListId,
  measurementId,
  direction,
}: {
  dataListId: number;
  measurementId: number;
  direction: "up" | "down";
}) {
  log.info({ dataListId, measurementId, direction }, "moving measurement");
  await DataListCollection.moveMeasurement(dataListId, measurementId, direction);
  log.info({ dataListId, measurementId, direction }, "measurement moved");
}

export async function setMeasurementIndent({
  dataListId,
  measurementId,
  direction,
}: {
  dataListId: number;
  measurementId: number;
  direction: "in" | "out";
}) {
  log.info({ dataListId, measurementId, direction }, "setting measurement indent");
  await DataListCollection.setMeasurementIndent(dataListId, measurementId, direction);
  log.info({ dataListId, measurementId, direction }, "measurement indent set");
}

export async function replaceAllMeasurements({
  dataListId,
  prefixes,
  universe,
}: {
  dataListId: number;
  prefixes: string[];
  universe: Universe;
}) {
  log.info(
    { dataListId, prefixCount: prefixes.length },
    "replacing all measurements",
  );
  const result = await DataListCollection.replaceAllMeasurements(
    dataListId,
    prefixes,
    universe,
  );
  if (result.unknownPrefixes.length > 0) {
    log.warn(
      { unknownPrefixes: result.unknownPrefixes },
      "unknown prefixes found",
    );
    return {
      success: false as const,
      message: `Unknown prefixes: ${result.unknownPrefixes.join(", ")}`,
      unknownPrefixes: result.unknownPrefixes,
    };
  }
  log.info({ dataListId }, "measurements replaced");
  return {
    success: true as const,
    message: `Replaced with ${prefixes.length} measurements`,
    unknownPrefixes: [] as string[],
  };
}

export async function getDataListSuperTable({
  id,
  universe,
  freq = "A",
  geo = "HI",
  sa = "all",
}: {
  id: number;
  universe: Universe;
  freq?: string;
  geo?: string;
  sa?: string;
}): Promise<SuperTableData> {
  log.info({ id, freq, geo, sa }, "fetching super table data");

  const [dataList, rows, availableFilters] = await Promise.all([
    DataListCollection.getById(id),
    DataListCollection.getSuperTableData(id, { freq, geo, sa }),
    DataListCollection.getAvailableFilters(id),
  ]);

  // Group rows by series_id
  const seriesMap = new Map<
    number,
    {
      entry: Omit<SuperTableSeriesEntry, "data">;
      data: [string, number][];
    }
  >();

  const allDatesSet = new Set<string>();

  for (const row of rows) {
    if (!seriesMap.has(row.series_id)) {
      const freqCode = Series.codeFromFrequency(row.frequency);
      seriesMap.set(row.series_id, {
        entry: {
          seriesId: row.series_id,
          seriesName: row.series_name,
          measurementId: row.measurement_id,
          measurementPrefix: row.measurement_prefix,
          dataPortalName: row.data_portal_name,
          listOrder: row.list_order,
          indent: row.indent,
          decimals: row.decimals,
          frequencyCode: freqCode,
          frequency: row.frequency,
          unitShortLabel: row.unit_short_label,
        },
        data: [],
      });
    }

    if (row.date != null && row.value != null) {
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date).slice(0, 10);
      seriesMap.get(row.series_id)!.data.push([dateStr, Number(row.value)]);
      allDatesSet.add(dateStr);
    }
  }

  const series: SuperTableSeriesEntry[] = [];
  for (const { entry, data } of seriesMap.values()) {
    data.sort(([a], [b]) => a.localeCompare(b));
    series.push({ ...entry, data });
  }

  const allDates = [...allDatesSet].sort();

  log.info(
    { seriesCount: series.length, dateCount: allDates.length },
    "super table data fetched",
  );

  // Map frequency long names to codes/labels for the dropdown
  const FREQ_LABELS: Record<string, string> = {
    A: "Annual",
    S: "Semi-Annual",
    Q: "Quarterly",
    M: "Monthly",
    W: "Weekly",
    D: "Daily",
  };
  const availableFrequencies: { code: string; label: string }[] = [];
  for (const longName of availableFilters.frequencies) {
    const code = Series.codeFromFrequency(longName);
    if (code) {
      availableFrequencies.push({ code, label: FREQ_LABELS[code] ?? code });
    }
  }

  return {
    dataList: {
      id: dataList.id,
      name: dataList.name,
      universe: dataList.universe,
    },
    series,
    allDates,
    geographies: availableFilters.geographies,
    availableFrequencies,
    filters: { freq, geo, sa },
  };
}
