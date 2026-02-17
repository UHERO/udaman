"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { lookupSeriesIdByName } from "@/actions/series-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AnalyzeSearchInput() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { universe } = useParams();
  const base = `/udaman/${universe}/series/analyze`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    // Numeric — navigate directly by ID
    if (/^\d+$/.test(trimmed)) {
      router.push(`${base}?id=${trimmed}`);
      return;
    }

    // Name — look up the ID via server action
    setLoading(true);
    setError(null);
    const result = await lookupSeriesIdByName(trimmed);
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    router.push(`${base}?id=${result.id}`);
  };

  return (
    <div className="space-y-1.5">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Series ID or name, e.g. 42 or E_NF@HI.M"
          className="flex-1 font-mono text-sm"
          disabled={loading}
        />
        <Button type="submit" size="sm" variant="outline" disabled={loading}>
          <Search className="mr-1.5 h-4 w-4" />
          {loading ? "Loading..." : "Analyze"}
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
