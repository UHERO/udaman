"use server";

import { ExpandedSeries } from "@/types/rest-api";

const BASE_URL = process.env.REST_API_V1_URL ?? "";
const TOKEN = process.env.REST_API_TOKEN ?? "";

export async function fetchSeries(
  name: string,
  freq: string
): Promise<ExpandedSeries> {
  const res = await fetchFromRestApi<ExpandedSeries>({
    baseUrl: BASE_URL as string,
    resource: "series",
    params: {
      u: "uhero",
      name: name,
      freq: freq,
      expand: "raw",
      nocache: "",
    },
  });

  return res;
}

export async function fetchFromRestApi<T>({
  baseUrl,
  resource,
  params,
  headers,
}: {
  baseUrl: string;
  params: { [key: string]: string };
  resource: string;
  headers?: HeadersInit;
}): Promise<T> {
  const urlParams = new URLSearchParams(params);
  try {
    const res = await fetch(`${baseUrl}/${resource}?${urlParams}`, {
      headers: {
        Authorization: TOKEN,
        ...headers,
      },
      next: { revalidate: 60 },
    });
    const json = await res.json();
    return json.data;
  } catch (e) {
    console.error(e);
    throw e;
  }
}
