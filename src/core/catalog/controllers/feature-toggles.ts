import "server-only";

import { createLogger } from "@/core/observability/logger";

import FeatureToggleCollection from "../collections/feature-toggle-collection";

const log = createLogger("catalog.feature-toggles");

export async function listFeatureToggles() {
  const toggles = await FeatureToggleCollection.list();
  return toggles.map((t) => t.toJSON());
}

export async function updateFeatureToggleStatus({
  id,
  status,
}: {
  id: number;
  status: boolean;
}) {
  const toggle = await FeatureToggleCollection.updateStatus(id, status);
  log.info({ id, name: toggle.name, status }, "Feature toggle updated");
  return toggle.toJSON();
}
