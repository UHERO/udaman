"use server";

import { requireAuth } from "@/lib/auth/dal";
import PermissionCollection from "@catalog/collections/permission-collection";

export async function updatePermissions(payload: {
  updates: { id: number; allowed: boolean }[];
  creates: { role: string; resource: string; action: string; allowed: boolean }[];
}): Promise<{ message: string }> {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    throw new Error("Unauthorized: dev role required");
  }

  if (payload.updates.length > 0) {
    await PermissionCollection.bulkUpdateAllowed(payload.updates);
  }
  if (payload.creates.length > 0) {
    await PermissionCollection.bulkCreate(payload.creates);
  }

  const total = payload.updates.length + payload.creates.length;
  return { message: `Saved ${total} permission(s)` };
}
