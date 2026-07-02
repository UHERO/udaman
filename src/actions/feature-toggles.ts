"use server";

import {
  listFeatureToggles,
  updateFeatureToggleStatus,
} from "@catalog/controllers/feature-toggles";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.feature-toggles");

export async function listFeatureTogglesAction() {
  await requirePermission("feature-toggle", "read");
  return listFeatureToggles();
}

export async function updateFeatureToggleStatusAction(
  id: number,
  status: boolean,
): Promise<{ success: boolean; message: string }> {
  const { userId } = await requirePermission("*", "update");

  try {
    const toggle = await updateFeatureToggleStatus({ id, status });
    log.info({ id }, "updateFeatureToggleStatusAction completed");
    return {
      success: true,
      message: `${toggle.name} ${status ? "enabled" : "disabled"}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateFeatureToggleStatusAction failed");
    AppLogCollection.logError(err, { userId, name: "feature-toggle.update" });
    return { success: false, message: `Failed to update toggle: ${message}` };
  }
}
