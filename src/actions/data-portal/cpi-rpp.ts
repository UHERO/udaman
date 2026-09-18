"use server";

import { ExternalServiceError } from "@/lib/errors";
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
    throw new ExternalServiceError(
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
    throw new ExternalServiceError(
      `fetchFromRestApi: network error fetching ${url}: ${(e as Error).message}`,
      { url },
    );
  }

  // Read once as text so we can include a body preview in any error we throw.
  const bodyText = await res.text();

  if (!res.ok) {
    throw new ExternalServiceError(
      `fetchFromRestApi: ${res.status} ${res.statusText} from ${url} — body: ${previewBody(bodyText)}`,
      { url, statusCode: res.status },
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new ExternalServiceError(
      `fetchFromRestApi: expected JSON but got "${contentType}" from ${url} — body: ${previewBody(bodyText)}`,
      { url, contentType },
    );
  }

  try {
    const json = JSON.parse(bodyText);
    return json.data;
  } catch (e) {
    throw new ExternalServiceError(
      `fetchFromRestApi: invalid JSON from ${url} (${(e as Error).message}) — body: ${previewBody(bodyText)}`,
      { url },
    );
  }
}

function previewBody(body: string, maxLen = 200): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  return trimmed.length > maxLen
    ? `${JSON.stringify(trimmed.slice(0, maxLen))}…`
    : JSON.stringify(trimmed);
}
