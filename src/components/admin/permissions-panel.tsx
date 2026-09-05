"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updatePermissions } from "@/actions/permissions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRUD_ACTIONS, RESOURCE_PARENTS } from "@/lib/auth/resources";
import type { Role } from "@/lib/auth/roles";
import { ROUTES } from "@/lib/auth/route-access";

type SerializedPermission = {
  id: number;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
};

/** A cell in the grid — may or may not have a DB row yet. */
type PermissionEntry = {
  id: number | null;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
};

const ROLE_ORDER: readonly Role[] = [
  "dev",
  "admin",
  "fellow",
  "internal",
  "fsonly",
  "external",
];

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  dev: "Full access to all resources including admin features, permission management, and dangerous operations like database maintenance.",
  admin:
    "Full access to every tool. Cannot access developer-only admin pages or modify permissions.",
  fellow:
    "Research fellows. Housing Database, Comms, and Registry by default. These switches are the whole policy for this role — there is no hardcoded rule behind them.",
  internal:
    "The role every new account starts with. Comms (pre-release forms) only; promote the user to grant anything else. Sidebar items and pages stay hidden regardless of these switches.",
  fsonly:
    "Forecast-only users. Can read forecast snapshots and download exports.",
  external:
    "DBEDT uploaders. Can use the Econ and Tour upload pages and nothing else.",
};

/** One matrix row per top-level sidebar/rail item, in manifest order. */
const MATRIX_ROWS = ROUTES.map((entry) => ({
  label: entry.label,
  resource: entry.resource,
  children: Object.entries(RESOURCE_PARENTS)
    .filter(([, parent]) => parent === entry.resource)
    .map(([child]) => child),
}));
const MATRIX_RESOURCES = new Set(MATRIX_ROWS.map((r) => r.resource));
const MATRIX_ACTIONS = new Set<string>(CRUD_ACTIONS);

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

  // Index existing permissions for fast lookup
  const permIndex = new Map<string, SerializedPermission>();
  for (const p of permissions) {
    permIndex.set(entryKey(p.role, p.resource, p.action), p);
  }

  function getEntry(
    role: string,
    resource: string,
    action: string,
  ): PermissionEntry {
    const existing = permIndex.get(entryKey(role, resource, action));
    return existing
      ? { ...existing }
      : { id: null, role, resource, action, allowed: false };
  }

  // Rules that don't fit the CRUD matrix: wildcards, fine-grained resources,
  // and non-CRUD actions like execute / csv-download. Shown so nothing an
  // earlier migration created is hidden from the person editing policy.
  const otherPairs = Array.from(
    new Set(
      permissions
        .filter(
          (p) =>
            !MATRIX_RESOURCES.has(p.resource) || !MATRIX_ACTIONS.has(p.action),
        )
        .map((p) => `${p.resource}\0${p.action}`),
    ),
  )
    .map((s) => {
      const [resource, action] = s.split("\0");
      return { resource, action };
    })
    .sort(
      (a, b) =>
        a.resource.localeCompare(b.resource) ||
        a.action.localeCompare(b.action),
    );

  function isAllowed(entry: PermissionEntry): boolean {
    const key = entryKey(entry.role, entry.resource, entry.action);
    return dirty.has(key) ? dirty.get(key)! : entry.allowed;
  }

  function toggle(entry: PermissionEntry) {
    const key = entryKey(entry.role, entry.resource, entry.action);
    setDirty((prev) => {
      const next = new Map(prev);
      const newValue = !isAllowed(entry);
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

  function Cell({ entry }: { entry: PermissionEntry }) {
    return (
      <TableCell className="text-center">
        <Switch
          checked={isAllowed(entry)}
          onCheckedChange={() => toggle(entry)}
          aria-label={`${entry.role} ${entry.action} ${entry.resource}`}
        />
      </TableCell>
    );
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
        <TabsContent key={role} value={role} className="space-y-6">
          <p className="text-muted-foreground text-sm">
            {ROLE_DESCRIPTIONS[role]}
          </p>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Sidebar items</h2>
            <p className="text-muted-foreground text-xs">
              One row per top-level item. A rule here also covers the
              item&apos;s finer-grained resources unless a more specific rule
              exists below.
            </p>
            <div className="max-w-3xl rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Resource</TableHead>
                    {CRUD_ACTIONS.map((action) => (
                      <TableHead
                        key={action}
                        className="w-20 text-center capitalize"
                      >
                        {action}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MATRIX_ROWS.map((row) => (
                    <TableRow key={row.resource}>
                      <TableCell className="text-sm font-medium">
                        {row.label}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.resource}
                        {row.children.length > 0 && (
                          <span
                            className="text-muted-foreground block truncate"
                            title={row.children.join(", ")}
                          >
                            + {row.children.join(", ")}
                          </span>
                        )}
                      </TableCell>
                      {CRUD_ACTIONS.map((action) => (
                        <Cell
                          key={action}
                          entry={getEntry(role, row.resource, action)}
                        />
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {otherPairs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Other rules</h2>
              <p className="text-muted-foreground text-xs">
                Wildcards, fine-grained resources, and non-CRUD actions. A
                specific rule beats a sidebar-item rule, which beats a wildcard.
              </p>
              <div className="max-w-lg rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="w-24 text-center">
                        Allowed
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherPairs.map(({ resource, action }) => {
                      const entry = getEntry(role, resource, action);
                      return (
                        <TableRow key={entryKey(role, resource, action)}>
                          <TableCell className="font-mono text-sm">
                            {displayLabel(resource)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {displayLabel(action)}
                          </TableCell>
                          <Cell entry={entry} />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
