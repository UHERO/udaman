"use client";

import { useEffect } from "react";

import { pushRecentSeries } from "@/hooks/use-recent-series";

interface RecordSeriesViewProps {
  id: number;
  name: string;
  universe: string;
  description?: string | null;
  dataPortalName?: string | null;
}

export function RecordSeriesView({
  id,
  name,
  universe,
  description,
  dataPortalName,
}: RecordSeriesViewProps) {
  useEffect(() => {
    pushRecentSeries({ id, name, universe, description, dataPortalName });
  }, [id, name, universe, description, dataPortalName]);

  return null;
}
