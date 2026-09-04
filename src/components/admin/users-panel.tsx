"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatHst } from "@catalog/utils/time";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { updateUserRole } from "@/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ALL_ROLES } from "@/lib/auth/roles";

import { UserFormSheet } from "./user-form-sheet";
import type { SerializedUser } from "./user-form-sheet";

const ROLES = ALL_ROLES;

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  dev: "default",
  admin: "default",
  fellow: "secondary",
  internal: "secondary",
  fsonly: "outline",
  external: "outline",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return formatHst(iso, "MMM d, yyyy");
}

/** Activity and sign-in times are worth the clock component; absent reads
 *  better as "Never" than as a dash. */
function formatSignIn(iso: string | null): string {
  if (!iso) return "Never";
  return formatHst(iso, "MMM d, yyyy h:mm a");
}

/** Sign-in detail behind the Last Active cell — useful for "where did they
 *  log in from", which is a different question than "are they using it". */
function SignInDetail({ user }: { user: SerializedUser }) {
  return (
    <div className="space-y-1 text-xs">
      <p>
        <span className="opacity-70">Signed in: </span>
        {formatSignIn(user.currentSignInAt)}
        {user.currentSignInIp && ` from ${user.currentSignInIp}`}
      </p>
      <p>
        <span className="opacity-70">Previous: </span>
        {formatSignIn(user.lastSignInAt)}
        {user.lastSignInIp && ` from ${user.lastSignInIp}`}
      </p>
      <p className="opacity-70">
        {user.signInCount} sign-in{user.signInCount !== 1 && "s"} total
      </p>
    </div>
  );
}

export default function UsersPanel({ users }: { users: SerializedUser[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  // null → the sheet is in "create" mode; a user → "edit" mode.
  const [editingUser, setEditingUser] = useState<SerializedUser | null>(null);

  function openCreate() {
    setEditingUser(null);
    setSheetOpen(true);
  }

  function openEdit(user: SerializedUser) {
    setEditingUser(user);
    setSheetOpen(true);
  }

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
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {users.length} user{users.length !== 1 && "s"}
        </p>
        <Button className="cursor-pointer" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New User
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Universe</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px] text-right">Edit</TableHead>
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
                        <SelectItem
                          key={role}
                          value={role}
                          className="capitalize"
                        >
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground cursor-default text-sm underline decoration-dotted underline-offset-4">
                        {formatSignIn(user.lastActiveAt)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <SignInDetail user={user} />
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">
                    {formatDate(user.createdAt)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer"
                    aria-label={`Edit ${user.email}`}
                    onClick={() => openEdit(user)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground text-center"
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <UserFormSheet
        key={editingUser?.id ?? "new"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editingUser}
      />
    </>
  );
}
