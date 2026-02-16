"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CompareAddInputProps {
  currentNames: string[];
}

export function CompareAddInput({ currentNames }: CompareAddInputProps) {
  const [value, setValue] = useState("");
  const router = useRouter();
  const { universe } = useParams();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    const updated = [...currentNames, trimmed];
    router.push(
      `/udaman/${universe}/series/compare?names=${encodeURIComponent(updated.join(","))}`,
    );
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add series name, e.g. E_NF@HI.M"
        className="flex-1 font-mono text-sm"
      />
      <Button type="submit" size="sm" variant="outline">
        <Plus className="mr-1.5 h-4 w-4" />
        Add
      </Button>
    </form>
  );
}
