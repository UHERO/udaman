import { SeasonalAdjustment } from "@catalog/types/shared";
import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface SAIndicatorProps extends ComponentProps<"span"> {
  sa: SeasonalAdjustment | null;
}

export const SAIndicator = ({ sa, className, ...props }: SAIndicatorProps) => {
  if (sa === null) sa = "not_applicable";
  const saMap = {
    not_seasonally_adjusted: "NS",
    seasonally_adjusted: "SA",
    not_applicable: "NA",
  };

  const saVariant = {
    seasonally_adjusted: "text-green-600",
    not_seasonally_adjusted: "text-orange-600",
    not_applicable: "text-primary",
  };

  return (
    <span className={cn(saVariant[sa], className)} {...props}>
      {saMap[sa]}
    </span>
  );
};
