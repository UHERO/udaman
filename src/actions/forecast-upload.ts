"use server";

import { revalidatePath } from "next/cache";
import { processForecastUpload } from "@catalog/controllers/forecast-upload";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.forecast-upload");

export async function uploadForecast(formData: FormData): Promise<{
  success: boolean;
  message: string;
  seriesIds?: number[];
  created?: number;
  updated?: number;
}> {
  const { userId } = await requirePermission("series", "create");

  const file = formData.get("file") as File | null;
  const year = parseInt(formData.get("year") as string, 10);
  const quarter = parseInt(formData.get("quarter") as string, 10);
  const version = (formData.get("version") as string) || "FF";
  const freq = formData.get("freq") as string as "A" | "Q";

  if (!file || file.size === 0) {
    return { success: false, message: "No file provided" };
  }

  if (isNaN(year) || year < 2000 || year > 2100) {
    return { success: false, message: "Invalid year" };
  }

  if (isNaN(quarter) || quarter < 1 || quarter > 4) {
    return { success: false, message: "Invalid quarter" };
  }

  if (freq !== "A" && freq !== "Q") {
    return { success: false, message: "Invalid frequency — must be A or Q" };
  }

  log.info(
    { filename: file.name, year, quarter, version, freq },
    "uploadForecast action called",
  );

  try {
    const fileContent = await file.text();
    const result = await processForecastUpload({
      fileContent,
      filename: file.name,
      year,
      quarter,
      version,
      freq,
    });

    revalidatePath("/udaman/FC/series");

    log.info(
      { created: result.created, updated: result.updated },
      "uploadForecast action completed",
    );

    return {
      success: true,
      message: result.message,
      seriesIds: result.seriesIds,
      created: result.created,
      updated: result.updated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "uploadForecast action failed");
    AppLogCollection.logError(err, { userId, name: "forecast-upload.upload" });
    return { success: false, message: `Upload failed: ${message}` };
  }
}
