"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PortalSelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

/**
 * Square, compact select used by every portal selector (geo, freq, forecast,
 * measurement). Content renders in a portal outside `.data-portal`, so the
 * square corners are set explicitly here.
 */
export function PortalSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  disabled,
  className,
}: {
  value: string | null | undefined;
  options: PortalSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled || options.length === 0}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "min-w-36 rounded-none bg-white text-sm shadow-none",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80 rounded-none">
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className="rounded-none"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
