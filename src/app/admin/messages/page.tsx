import { notFound } from "next/navigation";

import { listMessagesAction } from "@/actions/messages";
import { MessagesPanel } from "@/components/admin/messages-panel";
import { requireAuth } from "@/lib/auth/dal";

export default async function MessagesPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const messages = await listMessagesAction();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground text-sm">
          Send test notifications and view message history.
        </p>
      </div>
      <MessagesPanel initialMessages={messages} />
    </div>
  );
}
