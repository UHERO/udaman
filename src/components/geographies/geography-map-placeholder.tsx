import { MapPinned } from "lucide-react";

/**
 * Stand-in for the geography's GeoJSON boundary map. Boundary data isn't
 * loaded yet; swap this for the real map once it is — same footprint, so the
 * detail page layout won't shift.
 */
export function GeographyMapPlaceholder({ name }: { name: string }) {
  return (
    <div
      className="bg-muted/40 text-muted-foreground flex h-64 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed md:w-96"
      role="img"
      aria-label={`Map of ${name} (not yet available)`}
    >
      <MapPinned className="size-8 opacity-60" />
      <p className="text-sm font-medium">Map coming soon</p>
      <p className="text-xs">No boundary data loaded for {name}</p>
    </div>
  );
}
