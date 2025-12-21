"use server";

import { notFound } from "next/navigation";

/** Fetch and Error handling for udaman server fetching */
export async function udamanFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const url = `${process.env.API_BASE_URL || "http://127.0.0.1:3001"}${endpoint}`;
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`${response.status} - ${response.statusText}`);
    }

    // Handle 204 No Content responses (e.g., DELETE requests)
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new Error("Response is not JSON");
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length === 0) {
      notFound();
    }
    if (data && typeof data === "object" && Object.keys(data).length === 0) {
      notFound();
    }
    return data;
  } catch (error) {
    console.log("UDAMAN FETCH ERROR ", error);
    throw error;
  }
}

/** Little helper for testing server action error handling */
export async function oopsie() {
  throw new Error("Oopsie!");
}
