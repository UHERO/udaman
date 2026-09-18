import { notFound } from "next/navigation";

import { listUsers } from "@/actions/users";
import UsersPanel from "@/components/admin/users-panel";
import { WidthToggleBar } from "@/components/width-toggle-bar";
import { requireAuth } from "@/lib/auth/dal";

export default async function UsersPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const users = await listUsers();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm">
          View all users and manage their roles.
        </p>
      </div>
      <WidthToggleBar />

      <UsersPanel users={users} />
    </div>
  );
}
