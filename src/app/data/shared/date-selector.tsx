"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DateOptions } from "../dbedt/types";
import { q } from "./utils";

export default function DateSelector({
  minObsYr,
  minObsMo,
  maxObsYr,
  maxObsMo,
  dateRange,
  handleSelectedDates,
  frequencies,
  showSelector,
  regions,
}: {
  minObsYr: string;
  minObsMo: string;
  maxObsYr: string;
  maxObsMo: string;
  dateRange: { [key: string]: string };
  handleSelectedDates: (value: string, type: DateOptions) => void;
  frequencies: Record<string, string | boolean>[];
  showSelector: boolean;
  regions?: Record<string, string | boolean>[];
}) {
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showQtrSelector, setShowQtrSelector] = useState(false);

  /***************************************************************************************
   *   DBEDT allows for multiple frequency selections at a time. If Monthly & Quarterly
   *   are both selected, only show Monthly selector
   *
   *   DVW only allows for one frequency  to be selected at a time
   ***************************************************************************************/

  useEffect(() => {
    setShowMonthSelector(frequencies?.some((f) => f.state && f.id === "M"));
    setShowQtrSelector(
      frequencies?.some((f) => f.state && f.id === "Q") &&
        !frequencies?.some((f) => f.state && f.id === "M") &&
        (regions?.some((r) => r.state) ?? true)
    );
  }, [regions, frequencies]);

  return (
    <div
      className={cn(
        frequencies.some((f) => f.state) && showSelector
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-45",
        "grid w-fit grid-cols-2 gap-x-2 md:flex"
      )}
    >
      <div className="block">
        <Label className="text-xs">From Year</Label>
        <Select
          value={dateRange.startYear ?? ""}
          onValueChange={(value) => handleSelectedDates(value, "startYear")}
        >
          <SelectTrigger className="w-[100px] text-xs">
            <SelectValue placeholder={minObsYr || "1990"} />
          </SelectTrigger>
          <SelectContent>
            {Array.from({
              length: parseInt(dateRange.endYear) - parseInt(minObsYr) + 1,
            }).map((_, i) => {
              const yr = (parseInt(minObsYr) + i).toString();
              return (
                <SelectItem
                  className="text-xs"
                  key={`start-yr-${yr}`}
                  value={yr}
                >
                  {yr}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className={cn(showMonthSelector ? "block" : "hidden")}>
        <Label className="text-xs">From Month</Label>
        <Select
          value={dateRange.startMonth ?? "01"}
          onValueChange={(value) => handleSelectedDates(value, "startMonth")}
        >
          <SelectTrigger className="w-[100px] text-xs">
            <SelectValue placeholder={minObsMo || "01"} />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }).map((_, idx) => {
              const mo = (idx + 1).toString().padStart(2, "0");
              const isStartYear = dateRange.startYear === minObsYr;
              const isSameYear = dateRange.startYear === dateRange.endYear;
              if (minObsMo && isStartYear && parseInt(mo) < parseInt(minObsMo))
                return null;

              if (isSameYear && mo > dateRange.endMonth) return null;

              return (
                <SelectItem
                  key={`mo-start-${idx}`}
                  className="text-xs"
                  value={mo}
                >
                  {mo}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className={cn(showQtrSelector ? "block" : "hidden")}>
        <Select
          value={q[dateRange.startQuarter] ?? ""}
          onValueChange={(value) => handleSelectedDates(value, "startQuarter")}
        >
          <Label className="text-xs">From Quarter</Label>
          <SelectTrigger className="w-[100px] text-xs">
            <SelectValue placeholder={q[minObsMo] || "Q1"} />
          </SelectTrigger>

          <SelectContent>
            {["01", "04", "07", "10"]
              .filter((qm) => {
                const isSameYear = dateRange.startYear === dateRange.endYear;
                if (isSameYear || dateRange.startYear === maxObsYr) {
                  return qm <= dateRange.endQuarter;
                }
                if (dateRange.startYear === minObsYr) {
                  return qm >= minObsMo;
                }
                return true;
              })
              .map((d, i) => (
                <SelectItem
                  key={`start-quar-${i}`}
                  className="text-xs"
                  value={q[d]}
                >
                  {q[d]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="block">
        <Select
          value={dateRange.endYear ?? ""}
          onValueChange={(value) => handleSelectedDates(value, "endYear")}
        >
          <Label className="text-xs">To Year</Label>
          <SelectTrigger className="w-[100px] text-xs">
            <SelectValue
              placeholder={
                dateRange.endYear || maxObsYr || new Date().getFullYear()
              }
            />
          </SelectTrigger>
          <SelectContent>
            {Array.from({
              length: parseInt(maxObsYr) - parseInt(dateRange.startYear) + 1,
            }).map((_, i) => {
              const yr = (parseInt(dateRange.startYear) + i).toString();
              return (
                <SelectItem
                  className="text-xs"
                  key={`endyr-${yr}-${i}`}
                  value={yr}
                >
                  {yr}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <div className={cn(showMonthSelector ? "block" : "hidden")}>
        <Select
          value={dateRange.endMonth ?? "01"}
          onValueChange={(value) => handleSelectedDates(value, "endMonth")}
        >
          <Label className="text-xs">To Month</Label>
          <SelectTrigger className="w-[100px] text-xs">
            <SelectValue placeholder={maxObsMo || "01"} />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }).map((_, idx) => {
              const mo = (idx + 1).toString().padStart(2, "0");
              const isSameYear = dateRange.startYear === dateRange.endYear;
              const isLatestYear = dateRange.endYear === maxObsYr;
              if (isSameYear && mo < dateRange.startMonth) return null;
              if (isLatestYear && mo > maxObsMo) return null;
              return (
                <SelectItem
                  key={`mo-end-${idx}`}
                  className="text-xs"
                  value={mo}
                >
                  {mo}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className={cn(showQtrSelector ? "block" : "hidden")}>
        <Select
          value={q[dateRange.endQuarter] || ""}
          onValueChange={(value) => handleSelectedDates(value, "endQuarter")}
        >
          <Label className="text-xs">To Quarter</Label>
          <SelectTrigger className={cn("w-[100px] text-xs")}>
            <SelectValue
              className="text-xs"
              placeholder={q[dateRange.endQuarter] || "Q1"}
            />
          </SelectTrigger>
          <SelectContent>
            {["01", "04", "07", "10"]
              .filter((qm) => {
                if (dateRange.endYear === maxObsYr) {
                  return qm <= maxObsMo;
                }
                const isSameYear = dateRange.startYear === dateRange.endYear;
                if (isSameYear) {
                  return qm >= dateRange.startQuarter;
                }

                return true;
              })
              .map((d, i) => (
                <SelectItem
                  key={`${i}-end-qtr`}
                  className="text-xs"
                  value={q[d]}
                >
                  {q[d]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
