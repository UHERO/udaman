"use server";

import {
  listFeatureToggles,
  updateFeatureToggleStatus,
} from "@catalog/controllers/feature-toggles";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.feature-toggles");

export async function listFeatureTogglesAction() {
  return listFeatureToggles();
}

export async function updateFeatureToggleStatusAction(
  id: number,
  status: boolean,
): Promise<{ success: boolean; message: string }> {
  await requirePermission("*", "update");

  try {
    const toggle = await updateFeatureToggleStatus({ id, status });
    log.info({ id }, "updateFeatureToggleStatusAction completed");
    return {
      success: true,
      message: `${toggle.name} ${status ? "enabled" : "disabled"}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "updateFeatureToggleStatusAction failed");
    return { success: false, message: `Failed to update toggle: ${message}` };
  }
}
