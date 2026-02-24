"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateUserRole } from "@/actions/users";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SerializedUser = {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  universe: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const ROLES = ["external", "fsonly", "internal", "admin", "dev"] as const;

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  dev: "default",
  admin: "default",
  internal: "secondary",
  fsonly: "outline",
  external: "outline",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UsersPanel({ users }: { users: SerializedUser[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(userId: number, newRole: string) {
    startTransition(async () => {
      try {
        const result = await updateUserRole(userId, newRole);
        toast.success(result.message);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update role");
      }
    });
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Universe</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.name || "-"}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Select
                  value={user.role ?? "external"}
                  onValueChange={(val) => handleRoleChange(user.id, val)}
                  disabled={isPending}
                >
                  <SelectTrigger size="sm" className="w-[120px]">
                    <SelectValue>
                      <Badge
                        variant={ROLE_VARIANT[user.role ?? "external"]}
                        className="capitalize"
                      >
                        {user.role ?? "external"}
                      </Badge>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role} className="capitalize">
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground text-sm">
                  {user.universe ?? "-"}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground text-sm">
                  {formatDate(user.createdAt)}
                </span>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
