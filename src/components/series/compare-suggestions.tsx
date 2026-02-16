"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompareSuggestionsProps {
  allGeosNames: string[] | null;
  saNsNames: string[] | null;
  universe: string;
}

export function CompareSuggestions({
  allGeosNames,
  saNsNames,
  universe,
}: CompareSuggestionsProps) {
  const router = useRouter();

  if (!allGeosNames && !saNsNames) return null;

  const handleSelect = (value: string) => {
    let names: string[];
    if (value === "all-geos" && allGeosNames) {
      names = allGeosNames;
    } else if (value === "sa-ns" && saNsNames) {
      names = saNsNames;
    } else {
      return;
    }
    const expr = names.join(",");
    router.push(
      `/udaman/${universe}/series/compare?names=${encodeURIComponent(expr)}`
    );
  };

  return (
    <Select onValueChange={handleSelect}>
      <SelectTrigger size="sm" className="w-auto text-xs">
        <SelectValue placeholder="Compare..." />
      </SelectTrigger>
      <SelectContent>
        {allGeosNames && (
          <SelectItem value="all-geos">Compare All Geos</SelectItem>
        )}
        {saNsNames && (
          <SelectItem value="sa-ns">Compare SA/NS</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
