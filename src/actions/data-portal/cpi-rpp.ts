"use server";

import { ExpandedSeries } from "@/types/rest-api";

const BASE_URL = process.env.REST_API_V1_URL ?? "";
const TOKEN = process.env.REST_API_TOKEN ?? "";

export async function fetchSeries(
  name: string,
  freq: string,
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
  if (!baseUrl) {
    throw new Error(
      `fetchFromRestApi: baseUrl is empty — is REST_API_V1_URL set in the environment?`,
    );
  }

  const urlParams = new URLSearchParams(params);
  const url = `${baseUrl}/${resource}?${urlParams}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: TOKEN,
        ...headers,
      },
      next: { revalidate: 60 },
    });
  } catch (e) {
    // Network / DNS / TLS failures land here.
    throw new Error(
      `fetchFromRestApi: network error fetching ${url}: ${(e as Error).message}`,
    );
  }

  // Read once as text so we can include a body preview in any error we throw.
  const bodyText = await res.text();

  if (!res.ok) {
    throw new Error(
      `fetchFromRestApi: ${res.status} ${res.statusText} from ${url} — body: ${previewBody(bodyText)}`,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new Error(
      `fetchFromRestApi: expected JSON but got "${contentType}" from ${url} — body: ${previewBody(bodyText)}`,
    );
  }

  try {
    const json = JSON.parse(bodyText);
    return json.data;
  } catch (e) {
    throw new Error(
      `fetchFromRestApi: invalid JSON from ${url} (${(e as Error).message}) — body: ${previewBody(bodyText)}`,
    );
  }
}

function previewBody(body: string, maxLen = 200): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  return trimmed.length > maxLen
    ? `${JSON.stringify(trimmed.slice(0, maxLen))}…`
    : JSON.stringify(trimmed);
}
