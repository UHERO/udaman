import { notFound } from "next/navigation";

import { listFeatureTogglesAction } from "@/actions/feature-toggles";
import FeatureTogglesPanel from "@/components/admin/feature-toggles-panel";
import { requireAuth } from "@/lib/auth/dal";

export default async function FeatureTogglesPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const toggles = await listFeatureTogglesAction();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Feature Toggles</h1>
        <p className="text-muted-foreground text-sm">
          Per-universe feature flags that control data loading and portal
          behavior.
        </p>
      </div>

      <FeatureTogglesPanel toggles={toggles} />
    </div>
  );
}
