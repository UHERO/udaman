"use server";

import { ActionResult, createActionResult } from "./types";

export async function withErrorHandling<T>(
  action: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const result = await action();
    return createActionResult.success(result);
  } catch (error) {
    console.error("Server action error:", error);

    // add error types more as needed
    if (error instanceof Error) {
      if (error.message.includes("404")) {
        return createActionResult.error("Resource not found", 404);
      }
      if (error.message.includes("400")) {
        return createActionResult.error(error.message, 400);
      }
    }

    return createActionResult.error(
      "Something went wrong. Please try again later."
    );
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(
    `${process.env.API_BASE_URL || "http://127.0.0.1:3001"}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    }
  );
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || "API request failed");
    error.name = `${response.status}`;
    throw error;
  }
  return data;
}
