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
  measurementNames: string[] | null;
  measurementCounterpartNames: string[] | null;
  counterpartLabel: string | null; // "SA" or "NS"
  universe: string;
}

export function CompareSuggestions({
  allGeosNames,
  saNsNames,
  measurementNames,
  measurementCounterpartNames,
  counterpartLabel,
  universe,
}: CompareSuggestionsProps) {
  const router = useRouter();

  if (
    !allGeosNames &&
    !saNsNames &&
    !measurementNames &&
    !measurementCounterpartNames
  )
    return null;

  const handleSelect = (value: string) => {
    let names: string[] | undefined;
    if (value === "all-geos" && allGeosNames) {
      names = allGeosNames;
    } else if (value === "sa-ns" && saNsNames) {
      names = saNsNames;
    } else if (value === "measurement" && measurementNames) {
      names = measurementNames;
    } else if (
      value === "measurement-counterpart" &&
      measurementCounterpartNames
    ) {
      names = measurementCounterpartNames;
    }
    if (!names) return;
    const expr = names.join(",");
    router.push(
      `/udaman/${universe}/series/compare?names=${encodeURIComponent(expr)}`,
    );
  };

  return (
    <Select onValueChange={handleSelect}>
      <SelectTrigger size="sm" className="w-auto text-xs">
        <SelectValue placeholder="Compare..." />
      </SelectTrigger>
      <SelectContent>
        {measurementNames && (
          <SelectItem value="measurement">Compare Measurement</SelectItem>
        )}
        {measurementCounterpartNames && counterpartLabel && (
          <SelectItem value="measurement-counterpart">
            Compare Measurement ({counterpartLabel})
          </SelectItem>
        )}
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
