"use server";

import { DvwSeries, ModuleDimension } from "@/app/data/dvw/types"

const API_URL = process.env.DVW_BASE_URL;
const TOKEN = process.env.REST_API_TOKEN;

export default async function fetchDimensions(
  mod: string
): Promise<ModuleDimension[]> {
  const res = await fetchFromDvwAPI<ModuleDimension[]>(`/dimensions/${mod}`);
  return res;
}

export async function fetchOptions(
  dimension: ModuleDimension,
  mod: string
): Promise<ModuleDimension[]> {
  const res = await fetchFromDvwAPI<ModuleDimension[]>(
    `/${dimension}/all/${mod}`
  );
  return res;
}

/***************************************************************************************
 *   Returns primary data structure in format:
 *   (example:)
 *       {
 *         indicators: ModuleDimension[],
 *         groups: ModuleDimension[],
 *       }
 *   Fuels the side panel for user selection, and every subsequent selection is
 *   another fetch for 1) frequency `getFrequencies()` and/or 2) series `getSeries()`
 ***************************************************************************************/

export async function fetchDimensionsWithOptions(
  mod: string
): Promise<Record<string, ModuleDimension[]>> {
  try {
    const output: Record<string, ModuleDimension[]> = {};
    const dimensions = await fetchDimensions(mod);
    for (const dimension of dimensions) {
      const optionsPre = await fetchOptions(dimension, mod);
      const options = mapDimensionOptions(optionsPre);

      output[dimension] = options;
    }

    return output;
  } catch (err) {
    console.error("Error fetching dimensions and/or options", err);
    return {};
  }
}

/***************************************************************************************
 *   Structures the dimension options to its respective parent
 *   Options are grouped based on its parent key (if it exists).
 *        1   A `children` key is created if option is a parent & any subsequent option
 *            is added as a child if parent key matches
 *        0   else its added to original optionTree[] as a singleton
 *
 *      Creates a dataMap of each option, loops through each option & retrieves parent
 *      from map (if it exists), then groups them appropriately
 *
 *      SAMPLE ENTRY IN dataMap
 *         VC312p: {
 *           module: 'CHAR',
 *           handle: 'VC312p',
 *           nameW: 'Hostel (%)',
 *           nameT: 'Accom: Hostel (%)',
 *           info: 'The percentage of visitors who stayed in hostel (statewide)',
 *           parent: 'VC300',
 *           level: 2,
 *           order: 12,
 *           unit: 'percent',
 *           decimal: '1'
 *         },
 ***************************************************************************************/

function mapDimensionOptions(options: ModuleDimension[]): ModuleDimension[] {
  const dataMap: Record<string, ModuleDimension> = options.reduce(
    (m, value) => ((m[value.handle] = value), m),
    {} as Record<string, ModuleDimension>
  );

  const optionTree: ModuleDimension[] = [];
  options.forEach((value) => {
    const parent = value.parent ? dataMap[value.parent] : undefined;
    value.state = false;
    if (parent) {
      (parent.children || (parent.children = [])).push(value);
    } else {
      optionTree.push(value);
    }
  });

  return optionTree;
}

export async function getFrequencies(
  mod: string,
  dimensions: string
): Promise<Record<string, string | boolean>[]> {
  const res = await fetchFromDvwAPI(`/freqavail/${mod}?${dimensions}`);
  return Array.isArray(res) ? res.map((d) => ({ id: d, state: false })) : [];
}

export async function getSeries(
  mod: string,
  dimensionList: string,
  freq: string
): Promise<DvwSeries[]> {
  const res = await fetchFromDvwAPI<DvwSeries[]>(
    `/series/${mod}?${dimensionList}&f=${freq}`
  );

  return res;
}

async function fetchFromDvwAPI<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: {
        Authorization: TOKEN,
      },
    });
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.error(`Error fetching ${path}`, err);
    throw err;
  }
}
