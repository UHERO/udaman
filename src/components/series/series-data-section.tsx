"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { VintageDataPoint } from "@catalog/collections/data-point-collection";

import { getAllDataPointVintages } from "@/actions/series-actions";

type VintageMap = Record<string, VintageDataPoint[]>;

type VintageContextValue = {
  vintages: VintageMap;
  vintagesLoaded: boolean;
};

type HoverContextValue = VintageContextValue & {
  hoveredDate: Date | null;
  setHoveredDate: (date: Date | null) => void;
};

// Three contexts rather than one so a hover only re-renders what reads the
// hovered date (the chart). Table rows read the setter and the vintages,
// neither of which changes while the pointer moves.
const HoveredDateContext = createContext<Date | null>(null);
const SetHoveredDateContext = createContext<(date: Date | null) => void>(
  () => {},
);
const VintageContext = createContext<VintageContextValue>({
  vintages: {},
  vintagesLoaded: false,
});

export function useSetHoveredDate() {
  return useContext(SetHoveredDateContext);
}

export function useSeriesVintages() {
  return useContext(VintageContext);
}

export function useSeriesHover(): HoverContextValue {
  const hoveredDate = useContext(HoveredDateContext);
  const setHoveredDate = useContext(SetHoveredDateContext);
  const vintages = useContext(VintageContext);
  return { hoveredDate, setHoveredDate, ...vintages };
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

  const vintageValue = useMemo(
    () => ({ vintages, vintagesLoaded }),
    [vintages, vintagesLoaded],
  );

  return (
    <SetHoveredDateContext.Provider value={setHoveredDate}>
      <VintageContext.Provider value={vintageValue}>
        <HoveredDateContext.Provider value={hoveredDate}>
          {children}
        </HoveredDateContext.Provider>
      </VintageContext.Provider>
    </SetHoveredDateContext.Provider>
  );
}
