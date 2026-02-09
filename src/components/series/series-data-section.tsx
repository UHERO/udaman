"use client";

import { createContext, useContext, useState } from "react";

type HoverContextValue = {
  hoveredDate: Date | null;
  setHoveredDate: (date: Date | null) => void;
};

const HoverContext = createContext<HoverContextValue>({
  hoveredDate: null,
  setHoveredDate: () => {},
});

export function useSeriesHover() {
  return useContext(HoverContext);
}

export function SeriesHoverProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  return (
    <HoverContext.Provider value={{ hoveredDate, setHoveredDate }}>
      {children}
    </HoverContext.Provider>
  );
}
