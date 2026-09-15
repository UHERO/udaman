import { notFound } from "next/navigation";

import { listMcpTokens } from "@/actions/oauth-tokens";
import { listUsers } from "@/actions/users";
import McpConnectionsPanel from "@/components/admin/mcp-connections-panel";
import UsersPanel from "@/components/admin/users-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WidthToggleBar } from "@/components/width-toggle-bar";
import { requireAuth } from "@/lib/auth/dal";

export default async function UsersPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const [users, tokens] = await Promise.all([listUsers(), listMcpTokens()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm">
          View all users, manage their roles, and see who has Claude connected.
        </p>
      </div>
      <WidthToggleBar />

      <Tabs defaultValue="users">
        <TabsList variant="line">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="mcp">MCP Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersPanel users={users} />
        </TabsContent>

        <TabsContent value="mcp">
          <McpConnectionsPanel tokens={tokens} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
