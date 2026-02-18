"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { updatePermissions } from "@/actions/permissions";

type SerializedPermission = {
  id: number;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
};

/** A row in the grid — may or may not have a DB row yet. */
type PermissionEntry = {
  id: number | null;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
};

const ROLE_ORDER = ["dev", "admin", "internal", "fsonly", "external"] as const;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  dev: "Full access to all resources including admin features, permission management, and dangerous operations like database maintenance.",
  admin:
    "Can manage most catalog resources (series, measurements, sources, etc.) but cannot access developer tools or modify permissions.",
  internal:
    "Read access to all data plus the ability to create and update series, measurements, and related catalog entries.",
  fsonly:
    "Limited access for forecast-only users. Can view and update series data but cannot modify catalog structure.",
  external:
    "Read-only access to published data. Cannot create, update, or delete any resources.",
};

function displayLabel(value: string): string {
  return value === "*" ? "all" : value;
}

function entryKey(role: string, resource: string, action: string): string {
  return `${role}:${resource}:${action}`;
}

export default function PermissionsPanel({
  permissions,
}: {
  permissions: SerializedPermission[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // dirty tracks toggled values by composite key
  const [dirty, setDirty] = useState<Map<string, boolean>>(new Map());

  // Build the full set of unique (resource, action) pairs across all roles
  const pairSet = new Set<string>();
  for (const p of permissions) {
    pairSet.add(`${p.resource}\0${p.action}`);
  }
  const pairs = Array.from(pairSet)
    .map((s) => {
      const [resource, action] = s.split("\0");
      return { resource, action };
    })
    .sort((a, b) => a.resource.localeCompare(b.resource) || a.action.localeCompare(b.action));

  // Index existing permissions for fast lookup
  const permIndex = new Map<string, SerializedPermission>();
  for (const p of permissions) {
    permIndex.set(entryKey(p.role, p.resource, p.action), p);
  }

  // Build full grid per role
  function getEntries(role: string): PermissionEntry[] {
    return pairs.map(({ resource, action }) => {
      const existing = permIndex.get(entryKey(role, resource, action));
      if (existing) {
        return { ...existing };
      }
      return { id: null, role, resource, action, allowed: false };
    });
  }

  function isAllowed(entry: PermissionEntry): boolean {
    const key = entryKey(entry.role, entry.resource, entry.action);
    return dirty.has(key) ? dirty.get(key)! : entry.allowed;
  }

  function toggle(entry: PermissionEntry) {
    const key = entryKey(entry.role, entry.resource, entry.action);
    setDirty((prev) => {
      const next = new Map(prev);
      const currentValue = isAllowed(entry);
      const newValue = !currentValue;
      // If toggling back to original, remove from dirty
      if (newValue === entry.allowed) {
        next.delete(key);
      } else {
        next.set(key, newValue);
      }
      return next;
    });
  }

  function handleSave() {
    const updates: { id: number; allowed: boolean }[] = [];
    const creates: {
      role: string;
      resource: string;
      action: string;
      allowed: boolean;
    }[] = [];

    for (const [key, allowed] of dirty.entries()) {
      const existing = permIndex.get(key);
      if (existing) {
        updates.push({ id: existing.id, allowed });
      } else {
        const [role, resource, action] = key.split(":");
        creates.push({ role, resource, action, allowed });
      }
    }

    startTransition(async () => {
      try {
        const result = await updatePermissions({ updates, creates });
        toast.success(result.message);
        setDirty(new Map());
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <Tabs defaultValue={ROLE_ORDER[0]}>
      <div className="flex items-center justify-between">
        <TabsList>
          {ROLE_ORDER.map((role) => (
            <TabsTrigger key={role} value={role} className="capitalize">
              {role}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          size="sm"
          disabled={dirty.size === 0 || isPending}
          onClick={handleSave}
        >
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>

      {ROLE_ORDER.map((role) => (
        <TabsContent key={role} value={role} className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {ROLE_DESCRIPTIONS[role]}
          </p>
          <div className="max-w-lg rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-24 text-center">Allowed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getEntries(role).map((entry) => (
                  <TableRow key={entryKey(entry.role, entry.resource, entry.action)}>
                    <TableCell className="font-mono text-sm">
                      {displayLabel(entry.resource)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {displayLabel(entry.action)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={isAllowed(entry)}
                        onCheckedChange={() => toggle(entry)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
