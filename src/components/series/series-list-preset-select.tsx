"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESETS = [
  { value: "recent-created", label: "Recently Created" },
  { value: "recent-updated", label: "Recently Updated" },
  { value: "recent-bls", label: "BLS Activity" },
  { value: "recent-fred", label: "FRED Activity" },
  { value: "recent-bea", label: "BEA Activity" },
  { value: "recent-hiwi", label: "HIWI Activity" },
] as const;

export const PRESET_LABELS: Record<string, string> = Object.fromEntries(
  PRESETS.map((p) => [p.value, p.label]),
);

export function SeriesListPresetSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("list") ?? "recent-created";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "recent-created") {
      params.delete("list");
    } else {
      params.set("list", value);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?");
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
