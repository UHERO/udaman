/**
 * Point → parcel TMK, from the statewide TMK polygon layer
 * (Statewide_TMKs.geojson: WGS84 lon/lat, one Feature per line as GDAL
 * writes it, ~384k parcels / 5.5M vertices).
 *
 * The layer is parcel-level, so every TMK ends in CPR 0000: a rental in a
 * condo tower resolves to the tower's parcel, never to the unit.
 *
 * A point inside a parcel is a "within" match; where parcels overlap, the
 * smallest wins. A point inside no parcel — geocoders often drop it on the
 * street in front of the lot — takes the nearest parcel edge within
 * maxNearestM as a "nearest" match, with the distance kept so researchers can
 * filter. Anything farther is left unmatched.
 */

import { createLogger } from "@/core/observability/logger";

const log = createLogger("renthub-parcels");

export const DEFAULT_PARCELS_PATH =
  "/Volumes/UHEROroot/work/research/housing/shapefiles/Statewide_TMKs.geojson";

/** Grid cell size in degrees (~550 m), the spatial index's bucket. */
const CELL = 0.005;
/** Metres per degree of latitude; longitude scales by cos(lat). */
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON_EQ = 111_320;

export type ParcelMatch = "within" | "nearest";

export interface ParcelHit {
  tmk: string;
  match: ParcelMatch;
  /** 0 for "within"; metres to the parcel edge for "nearest". */
  distanceM: number;
}

interface FeatureProps {
  division?: string;
  zone?: string;
  section?: string;
  plat1?: string;
  parcel1?: string;
  st_areashape?: number;
}

type Ring = number[][];
interface Geometry {
  type: string;
  coordinates: Ring[] | Ring[][];
}

/** `I-Z-S-PPP-PPP-0000`, the format every other hhdb table uses. */
export function parcelTmk(p: FeatureProps): string | null {
  const tmk = `${p.division}-${p.zone}-${p.section}-${p.plat1}-${p.parcel1}-0000`;
  return /^[1-4]-\d-\d-\d{3}-\d{3}-0000$/.test(tmk) ? tmk : null;
}

const cellKey = (cx: number, cy: number) => cx * 100_000 + cy;
const cellX = (lon: number) => Math.floor((lon + 180) / CELL);
const cellY = (lat: number) => Math.floor((lat + 90) / CELL);

/** Squared distance from (px,py) to segment (ax,ay)-(bx,by), all in metres. */
function segDist2(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + t * dx - px;
  const ey = ay + t * dy - py;
  return ex * ex + ey * ey;
}

export class ParcelIndex {
  private readonly tmks: string[] = [];
  private readonly areas: number[] = [];
  /** minLon, minLat, maxLon, maxLat per feature. */
  private readonly bbox: number[] = [];
  /** Per feature: first ring index; one extra entry closes the last feature. */
  private readonly featureRings: number[] = [0];
  /** Per ring: first vertex index; one extra entry closes the last ring. */
  private readonly ringVerts: number[] = [0];
  /** lon, lat interleaved. */
  private readonly coords: number[] = [];
  private readonly grid = new Map<number, number[]>();
  /** TMK → feature ids (a few TMKs have more than one polygon). */
  private readonly byTmk = new Map<string, number[]>();
  /** Per-feature query stamp, so a feature in several cells is tested once. */
  private seen = new Uint32Array(0);
  private stamp = 0;

  get size(): number {
    return this.tmks.length;
  }

  /** Add one GeoJSON feature. Returns false (and skips it) when it has no usable TMK or polygon. */
  add(props: FeatureProps, geometry: Geometry | null): boolean {
    const tmk = parcelTmk(props);
    if (!tmk || !geometry) return false;
    const polys =
      geometry.type === "Polygon"
        ? [geometry.coordinates as Ring[]]
        : geometry.type === "MultiPolygon"
          ? (geometry.coordinates as Ring[][])
          : null;
    if (!polys) return false;

    const id = this.tmks.length;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const poly of polys)
      for (const ring of poly) {
        for (const [x, y] of ring) {
          this.coords.push(x, y);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        this.ringVerts.push(this.coords.length / 2);
      }
    this.featureRings.push(this.ringVerts.length - 1);
    this.tmks.push(tmk);
    const same = this.byTmk.get(tmk);
    if (same) same.push(id);
    else this.byTmk.set(tmk, [id]);
    this.areas.push(props.st_areashape ?? Infinity);
    this.bbox.push(minX, minY, maxX, maxY);
    for (let cx = cellX(minX); cx <= cellX(maxX); cx++)
      for (let cy = cellY(minY); cy <= cellY(maxY); cy++) {
        const k = cellKey(cx, cy);
        const bucket = this.grid.get(k);
        if (bucket) bucket.push(id);
        else this.grid.set(k, [id]);
      }
    return true;
  }

  /** Even-odd ray cast over every ring of the feature (holes and multipolygons included). */
  private contains(id: number, lon: number, lat: number): boolean {
    let inside = false;
    for (let r = this.featureRings[id]; r < this.featureRings[id + 1]; r++) {
      const end = this.ringVerts[r + 1];
      for (let i = this.ringVerts[r], j = end - 1; i < end; j = i++) {
        const xi = this.coords[2 * i],
          yi = this.coords[2 * i + 1];
        const xj = this.coords[2 * j],
          yj = this.coords[2 * j + 1];
        if (
          yi > lat !== yj > lat &&
          lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
        )
          inside = !inside;
      }
    }
    return inside;
  }

  /** Metres from the point to the feature's nearest edge (equirectangular, fine at parcel scale). */
  private edgeDistanceM(id: number, lon: number, lat: number): number {
    const kx = M_PER_DEG_LON_EQ * Math.cos((lat * Math.PI) / 180);
    let best = Infinity;
    for (let r = this.featureRings[id]; r < this.featureRings[id + 1]; r++) {
      const end = this.ringVerts[r + 1];
      for (let i = this.ringVerts[r] + 1; i < end; i++) {
        const d = segDist2(
          0,
          0,
          (this.coords[2 * i - 2] - lon) * kx,
          (this.coords[2 * i - 1] - lat) * M_PER_DEG_LAT,
          (this.coords[2 * i] - lon) * kx,
          (this.coords[2 * i + 1] - lat) * M_PER_DEG_LAT,
        );
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  }

  /** Feature ids whose bbox overlaps [lon±dLon, lat±dLat], each once. */
  private candidates(
    lon: number,
    lat: number,
    dLon: number,
    dLat: number,
  ): number[] {
    if (this.seen.length !== this.tmks.length) {
      this.seen = new Uint32Array(this.tmks.length);
      this.stamp = 0;
    }
    const stamp = ++this.stamp;
    const out: number[] = [];
    for (let cx = cellX(lon - dLon); cx <= cellX(lon + dLon); cx++)
      for (let cy = cellY(lat - dLat); cy <= cellY(lat + dLat); cy++) {
        for (const id of this.grid.get(cellKey(cx, cy)) ?? []) {
          if (this.seen[id] === stamp) continue;
          this.seen[id] = stamp;
          const b = 4 * id;
          if (
            this.bbox[b] <= lon + dLon &&
            this.bbox[b + 2] >= lon - dLon &&
            this.bbox[b + 1] <= lat + dLat &&
            this.bbox[b + 3] >= lat - dLat
          )
            out.push(id);
        }
      }
    return out;
  }

  /**
   * Metres from the point to the parcel: 0 when inside it, else to its
   * nearest edge. null when the layer has no polygon for that TMK.
   */
  distanceToTmk(tmk: string, lat: number, lon: number): number | null {
    const ids = this.byTmk.get(tmk);
    if (!ids) return null;
    let best = Infinity;
    for (const id of ids) {
      if (this.contains(id, lon, lat)) return 0;
      best = Math.min(best, this.edgeDistanceM(id, lon, lat));
    }
    return best;
  }

  locate(lat: number, lon: number, maxNearestM: number): ParcelHit | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    let within = -1;
    for (const id of this.candidates(lon, lat, 0, 0))
      if (
        this.contains(id, lon, lat) &&
        (within < 0 || this.areas[id] < this.areas[within])
      )
        within = id;
    if (within >= 0)
      return { tmk: this.tmks[within], match: "within", distanceM: 0 };

    if (maxNearestM <= 0) return null;
    const dLat = maxNearestM / M_PER_DEG_LAT;
    const dLon =
      maxNearestM / (M_PER_DEG_LON_EQ * Math.cos((lat * Math.PI) / 180));
    let best = -1;
    let bestM = Infinity;
    for (const id of this.candidates(lon, lat, dLon, dLat)) {
      const m = this.edgeDistanceM(id, lon, lat);
      if (m < bestM) {
        bestM = m;
        best = id;
      }
    }
    return best >= 0 && bestM <= maxNearestM
      ? { tmk: this.tmks[best], match: "nearest", distanceM: bestM }
      : null;
  }

  /**
   * Stream the GeoJSON line by line (one Feature per line), so the 400 MB
   * file is never held as one string.
   */
  static async fromGeojson(path: string): Promise<ParcelIndex> {
    const file = Bun.file(path);
    if (!(await file.exists()))
      throw new Error(`Parcel layer not found: ${path} (is the NAS mounted?)`);
    const start = performance.now();
    const index = new ParcelIndex();
    let skipped = 0;
    let pending = "";
    const onLine = (line: string) => {
      if (!line.startsWith('{"type":"Feature"')) return;
      const f = JSON.parse(line.replace(/,\s*$/, "")) as {
        properties: FeatureProps;
        geometry: Geometry | null;
      };
      if (!index.add(f.properties, f.geometry)) skipped++;
    };
    const decoder = new TextDecoder();
    for await (const chunk of file.stream()) {
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop()!;
      for (const line of lines) onLine(line);
    }
    onLine(pending + decoder.decode());
    if (index.size === 0)
      throw new Error(
        `${path}: no parcel features (expected one Feature per line)`,
      );
    log.info(
      {
        path,
        parcels: index.size,
        skipped,
        ms: Math.round(performance.now() - start),
      },
      "parcel layer loaded",
    );
    return index;
  }
}
