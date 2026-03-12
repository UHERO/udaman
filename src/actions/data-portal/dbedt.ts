"use server";

/***************************************************************************************
 *  FLOW OF DATA RETRIEVAL:
 *    1) On intial page load, categories are fetched and grouped   fetchCategories()
 *    2) User selects an option from categories on side panel
 *       Ex: Population and Vital Statistics > Population Census
 *    3) Fetch suboptions                                          fetchCategoryMeasures()
 *    4) User selects desired suboption(s)
 *       Ex: Total Resident (Census)
 *    5) Fetch series                                              fetchMeasurementSeries()
         Note: Series are filtered based on user selected areas/frequencies
         on the client side, and displayed on results table
 ***************************************************************************************/
import { CategoryType, Series } from "@/app/data/dbedt/types";
import { fetchFromRestApi } from "./cpi-rpp";

const BASE_URL = process.env.REST_API_V1_URL;

/***************************************************************************************
 *   Structures category options to its respective parent and returns as a new arr
 *   for use in the dbedt side panel                                dbedt-sidebar.tsx
 *
 *   Options are grouped based on its parent key (if it exists).
 *        1   A `children` key is created if option is a parent & any subsequent option
 *            is added as a child if parent key matches
 *        0   else it's added to original categoryTree[] as a singleton
 ***************************************************************************************/
export default async function fetchCategories(): Promise<CategoryType[]> {
  const categoryTree: CategoryType[] = [];

  const categories: CategoryType[] = await fetchFromRestApi({
    baseUrl: BASE_URL as string,
    resource: "category",
    params: { u: "DBEDT" },
  });

  const idMap = categories.reduce<Record<number, CategoryType>>(
    (map, value) => ((map[value.id] = value), map),
    {}
  );

  categories.forEach((value) => {
    const parent = idMap[value.parentId];
    value.label = value.name;
    value.key = value.id;
    value.leaf = false;
    value.expanded = false;
    if (parent) {
      (parent.children || (parent.children = [])).push(value);
    } else {
      categoryTree.push(value);
    }
  });

  return categoryTree;
}

/***************************************************************************************
 *  Retrieves suboption(s) after user selects a category option from side panel
 *  Sample response:  [ { id: 163679, name: 'Total Resident (Census)' } ]
 ***************************************************************************************/
export async function fetchCategoryMeasures(
  id: string
): Promise<Record<string, string | boolean>[]> {
  try {
    const res: Record<string, string>[] = await fetchFromRestApi({
      baseUrl: BASE_URL as string,
      resource: "category/measurements",
      params: { id: id },
    });

    return res.map((d) => ({ ...d, state: false }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

/***************************************************************************************
 *   Returns raw data structure as Series[] for results table
 *   based on user selection. Note that this structure will be slightly transformed
 *   in handleResults() / formatObservations()                area-freq-selector.tsx
 ***************************************************************************************/
export async function fetchMeasurementSeries(id: string): Promise<Series[]> {
  const res: Series[] = await fetchFromRestApi({
    baseUrl: BASE_URL as string,
    resource: "measurement/series",
    params: { id: id, expand: "true" },
  });

  return res?.map((d) => ({ ...d, state: true })) ?? [];
}
