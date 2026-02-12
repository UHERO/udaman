"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getAllDataPointVintages } from "@/actions/series-actions";
import type { VintageDataPoint } from "@catalog/collections/data-point-collection";

type VintageMap = Record<string, VintageDataPoint[]>;

type HoverContextValue = {
  hoveredDate: Date | null;
  setHoveredDate: (date: Date | null) => void;
  vintages: VintageMap;
  vintagesLoaded: boolean;
};

const HoverContext = createContext<HoverContextValue>({
  hoveredDate: null,
  setHoveredDate: () => {},
  vintages: {},
  vintagesLoaded: false,
});

export function useSeriesHover() {
  return useContext(HoverContext);
}

export function SeriesHoverProvider({
  xseriesId,
  children,
}: {
  xseriesId: number;
  children: React.ReactNode;
}) {
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [vintages, setVintages] = useState<VintageMap>({});
  const [vintagesLoaded, setVintagesLoaded] = useState(false);

  const loadVintages = useCallback(async () => {
    const data = await getAllDataPointVintages(xseriesId);
    setVintages(data);
    setVintagesLoaded(true);
  }, [xseriesId]);

  useEffect(() => {
    loadVintages();
  }, [loadVintages]);

  return (
    <HoverContext.Provider value={{ hoveredDate, setHoveredDate, vintages, vintagesLoaded }}>
      {children}
    </HoverContext.Provider>
  );
}
