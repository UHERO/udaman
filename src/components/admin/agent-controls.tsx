"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createServiceTokenAction,
  revokeServiceTokenAction,
  setOpsSettingAction,
} from "@/actions/ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LEVELS = [
  { value: "0", label: "0 · propose" },
  { value: "1", label: "1 · apply + post" },
  { value: "2", label: "2 · apply, digest only" },
];

export function AutonomySelect({
  changeType,
  level,
}: {
  changeType: string;
  level: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      className="h-8 rounded-md border px-2 text-sm"
      disabled={pending}
      defaultValue={String(level)}
      onChange={(e) =>
        start(async () => {
          const r = await setOpsSettingAction(
            `autonomy.${changeType}`,
            e.target.value,
          );
          if (r.ok) {
            toast.success(`${changeType} → level ${e.target.value}`);
            router.refresh();
          } else toast.error(r.error);
        })
      }
    >
      {LEVELS.map((l) => (
        <option key={l.value} value={l.value}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

export function SettingInput({
  name,
  value,
  label,
  wide,
}: {
  name: string;
  value: string;
  label: string;
  wide?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-56">{label}</span>
      <Input
        className={wide ? "h-8 w-72" : "h-8 w-28"}
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending || v === value}
        onClick={() =>
          start(async () => {
            const r = await setOpsSettingAction(name, v);
            if (r.ok) {
              toast.success("Saved");
              router.refresh();
            } else toast.error(r.error);
          })
        }
      >
        Save
      </Button>
    </label>
  );
}

export function PauseToggle({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={paused ? "default" : "destructive"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setOpsSettingAction(
            "agent.paused",
            paused ? "0" : "1",
          );
          if (r.ok) router.refresh();
          else toast.error(r.error);
        })
      }
    >
      {paused ? "Resume agent" : "Pause agent"}
    </Button>
  );
}

export function TokenControls({
  tokens,
}: {
  tokens: Array<{
    id: number;
    name: string;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
    created_by: string | null;
  }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("workstation");
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Input
          className="h-8 w-56"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createServiceTokenAction(name);
              setFresh(r.token);
              router.refresh();
            })
          }
        >
          Create token
        </Button>
      </div>
      {fresh && (
        <div className="rounded border border-amber-400 bg-amber-50 p-2 dark:bg-amber-950">
          Copy now; it isn&apos;t shown again. Put it in the workstation&apos;s{" "}
          <code>OPS_MCP_TOKEN</code>:
          <pre className="mt-1 overflow-x-auto font-mono text-xs select-all">
            {fresh}
          </pre>
        </div>
      )}
      <ul className="space-y-1">
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <span
              className={
                t.revoked_at ? "text-muted-foreground line-through" : ""
              }
            >
              #{t.id} {t.name}
            </span>
            <span className="text-muted-foreground text-xs">
              by {t.created_by ?? "?"} · last used{" "}
              {t.last_used_at
                ? t.last_used_at.slice(0, 16).replace("T", " ")
                : "never"}
            </span>
            {!t.revoked_at && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await revokeServiceTokenAction(t.id);
                    router.refresh();
                  })
                }
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
