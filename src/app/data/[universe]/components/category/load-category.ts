/**
 * Server-side data flow for the landing / category page
 * (category-helper.getCategoryData). Pure orchestration over the portal
 * server actions + lib/category resolvers; returns a serializable result
 * for <CategoryView>.
 */
import "server-only";

import {
  fetchCategoryForecasts,
  fetchCategoryFreqs,
  fetchCategoryGeos,
  fetchCategoryMeasurements,
  fetchCategorySeries,
  fetchMeasurementSeries,
  fetchPortalCategories,
} from "@/actions/data-portal/portal";

import {
  resolveCategorySelection,
  resolveForecast,
  resolveGeoFreq,
  resolveMeasurement,
  seriesWithData,
} from "../../lib/category";
import type { PortalConfig } from "../../lib/config";
import type {
  CategoryNode,
  ExpandedSeries,
  Frequency,
  Geography,
  Measurement,
} from "../../lib/types";
import type { CategoryParams } from "../../lib/url-params";

export interface CategoryPageData {
  category: { id: number; name: string };
  dataList: { id: number; name: string };
  /** "Parent > Child > Leaf" (shown when categoryTabs is off). */
  dataListPath: string;
  /** Top-level category's children (tabs); keep children for firstDataList. */
  subcategories: CategoryNode[];
  geos: Geography[];
  freqs: Frequency[];
  geo: Geography | null;
  freq: Frequency;
  /** FC only. */
  forecasts: string[] | null;
  fc: string | null;
  /** NTA only. */
  measurements: Measurement[] | null;
  measurement: Measurement | null;
  /** Series with level observations. */
  series: ExpandedSeries[];
}

export type CategoryLoadResult =
  | { status: "ok"; data: CategoryPageData }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

const ANNUAL: Frequency = { freq: "A", label: "Annual" };

export async function loadCategoryPage(
  config: PortalConfig,
  query: CategoryParams,
): Promise<CategoryLoadResult> {
  const universe = config.universe;
  try {
    const { tree } = await fetchPortalCategories(universe, config.rootCategory);
    const selection = resolveCategorySelection(
      tree,
      typeof query.id === "number" ? query.id : null,
      query.data_list_id,
    );
    if (!selection) {
      return { status: "invalid", message: "Category does not exist." };
    }
    const { category, dataList, subcategories, dataListPath } = selection;
    const base = {
      category: { id: category.id, name: category.name },
      dataList: { id: dataList.id, name: dataList.name },
      dataListPath,
      subcategories,
    };

    if (config.categoryMode === "measurement") {
      const measurements = await fetchCategoryMeasurements(
        dataList.id,
        query.nocache,
      );
      const measurement = resolveMeasurement(measurements, query.m);
      const series = measurement
        ? await fetchMeasurementSeries(measurement.id, query.nocache)
        : [];
      return {
        status: "ok",
        data: {
          ...base,
          geos: [],
          freqs: [ANNUAL],
          geo: null,
          freq: ANNUAL,
          forecasts: null,
          fc: null,
          measurements,
          measurement,
          series: seriesWithData(series),
        },
      };
    }

    const wantsFc = config.selectors.includes("forecast");
    const [geoList, freqList, forecastList] = await Promise.all([
      fetchCategoryGeos(dataList.id),
      fetchCategoryFreqs(dataList.id),
      wantsFc ? fetchCategoryForecasts(dataList.id) : Promise.resolve(null),
    ]);
    const { geo, freq, geos, freqs } = resolveGeoFreq({
      geos: geoList,
      freqs: freqList,
      defaults: dataList.defaults,
      routeGeo: query.geo,
      routeFreq: query.freq,
    });
    const fc = wantsFc
      ? resolveForecast(forecastList, dataList.defaults?.fc, query.fc)
      : null;
    const series =
      geo && freq
        ? await fetchCategorySeries({
            universe,
            id: dataList.id,
            geo: geo.handle,
            freq: freq.freq,
            fc,
            noCache: query.nocache,
          })
        : [];
    return {
      status: "ok",
      data: {
        ...base,
        geos,
        freqs,
        geo,
        freq: freq ?? ANNUAL,
        forecasts: forecastList,
        fc,
        measurements: null,
        measurement: null,
        series: seriesWithData(series),
      },
    };
  } catch (e) {
    console.error(`data portal: category load failed for ${universe}`, e);
    return {
      status: "error",
      message: "The data service could not be reached. Please try again.",
    };
  }
}
