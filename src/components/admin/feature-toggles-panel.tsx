"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateFeatureToggleStatusAction } from "@/actions/feature-toggles";
import type { SerializedFeatureToggle } from "@catalog/models/feature-toggle";
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

interface Props {
  toggles: SerializedFeatureToggle[];
}

export default function FeatureTogglesPanel({ toggles }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticToggles, setOptimistic] = useOptimistic(
    toggles,
    (state, { id, status }: { id: number; status: boolean }) =>
      state.map((t) => (t.id === id ? { ...t, status } : t)),
  );

  function handleToggle(id: number, newStatus: boolean) {
    startTransition(async () => {
      setOptimistic({ id, status: newStatus });
      const result = await updateFeatureToggleStatusAction(id, newStatus);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      router.refresh();
    });
  }

  // Group by universe
  const byUniverse = new Map<string, typeof optimisticToggles>();
  for (const toggle of optimisticToggles) {
    const list = byUniverse.get(toggle.universe) ?? [];
    list.push(toggle);
    byUniverse.set(toggle.universe, list);
  }
  const universes = [...byUniverse.keys()].sort();

  if (universes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No feature toggles configured.
      </p>
    );
  }

  return (
    <Tabs defaultValue={universes[0]}>
      <TabsList>
        {universes.map((u) => (
          <TabsTrigger key={u} value={u}>
            {u}
          </TabsTrigger>
        ))}
      </TabsList>

      {universes.map((universe) => (
        <TabsContent key={universe} value={universe}>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byUniverse.get(universe)!.map((toggle) => (
                  <TableRow key={toggle.id}>
                    <TableCell className="font-mono text-sm">
                      {toggle.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {toggle.description || "No description"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={toggle.status}
                        disabled={isPending}
                        onCheckedChange={(checked) =>
                          handleToggle(toggle.id, checked)
                        }
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
