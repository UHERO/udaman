import { notFound } from "next/navigation";
import PermissionCollection from "@catalog/collections/permission-collection";

import PermissionsPanel from "@/components/admin/permissions-panel";
import { requireAuth } from "@/lib/auth/dal";

export default async function AdminPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const permissions = await PermissionCollection.list();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Permissions</h1>
        <p className="text-muted-foreground text-sm">
          Role-based permissions for all resources and actions.
        </p>
      </div>

      <PermissionsPanel permissions={permissions.map((p) => p.toJSON())} />
    </div>
  );
}
