/**
 * A listing's parcel TMK, from its point and its street address.
 *
 * The point alone is right ~90% of the time when it falls inside a parcel
 * and rarely when it doesn't (it is usually in the street). The address
 * fixes most of the rest: the parcel near the point whose qPublic site
 * address has the same house number and street is the lot.
 *
 *   within_addr  inside the parcel, and that parcel has the listing's address
 *   address      a parcel within the search radius has the exact address
 *                (overrides the parcel the point fell in, if any)
 *   fuzzy        same house number, street spelled a little differently
 *   address_far  the exact address is farther than the radius but on exactly
 *                one parcel within FAR_MAX_M — the vendor's point is wrong
 *                (seen 0.4–9 km off), the address is not
 *   within       inside the parcel, address unconfirmed (no listing address,
 *                or nothing nearby carries it)
 *   nearest      inside no parcel; nearest edge (opt-in, --max-nearest)
 */

import type { AddressIndex, AddressKey } from "../address";
import { FUZZY_MIN, normalizeAddress, streetSimilarity } from "../address";
import type { ParcelIndex } from "./parcels";

export const TMK_MATCHES = [
  "within_addr",
  "address",
  "fuzzy",
  "address_far",
  "within",
  "nearest",
] as const;
export type TmkMatch = (typeof TMK_MATCHES)[number];

export interface GeocodeHit {
  tmk: string;
  match: TmkMatch;
  /** Metres from the point to the parcel; 0 when inside. */
  distanceM: number;
  /** The qPublic address that matched (address-based matches only). */
  address: string | null;
}

export interface GeocodeOptions {
  /** Address search radius around the point in metres; 0 disables address matching. */
  addressRadiusM: number;
  /** Nearest-parcel fallback cutoff in metres; 0 disables it. */
  maxNearestM: number;
}

/** Never search farther than this, however coarse the coordinates. */
const MAX_RADIUS_M = 2000;
/**
 * address_far cutoff. Islands are ≥ ~15 km apart, so a match never crosses
 * to another island that happens to have the same number and street name.
 */
export const FAR_MAX_M = 10_000;

/**
 * Coarse coordinates widen the search: 3 decimals is ±55 m of rounding,
 * 2 is ±550 m. 1.5× the rounding step, never below `base`.
 */
export function searchRadiusM(
  base: number,
  coordDecimals: number | null,
): number {
  if (coordDecimals === null || coordDecimals >= 4) return base;
  const step = 111_000 * 10 ** -coordDecimals;
  return Math.min(MAX_RADIUS_M, Math.max(base, 1.5 * step));
}

interface Candidate {
  tmk: string;
  distanceM: number;
  address: string;
}

/** The closest of these parcels within radius, if any. */
function closest(
  parcels: Map<string, string>,
  lat: number,
  lon: number,
  radiusM: number,
  layer: ParcelIndex,
): Candidate | null {
  let best: Candidate | null = null;
  for (const [tmk, address] of parcels) {
    const d = layer.distanceToTmk(tmk, lat, lon);
    if (d !== null && d <= radiusM && (!best || d < best.distanceM))
      best = { tmk, distanceM: d, address };
  }
  return best;
}

function byAddress(
  key: AddressKey,
  lat: number,
  lon: number,
  radiusM: number,
  layer: ParcelIndex,
  addresses: AddressIndex,
): (Candidate & { kind: "address" | "fuzzy" | "address_far" }) | null {
  const streets = addresses.streetsWithNumber(key.num);
  if (!streets) return null;
  const exact = streets.get(key.street);
  const hit = exact && closest(exact, lat, lon, radiusM, layer);
  if (hit) return { ...hit, kind: "address" };

  let best: (Candidate & { sim: number }) | null = null;
  for (const [street, parcels] of streets) {
    if (street === key.street) continue;
    const sim = streetSimilarity(key.street, street);
    if (sim < FUZZY_MIN) continue;
    const c = closest(parcels, lat, lon, radiusM, layer);
    if (
      c &&
      (!best ||
        sim > best.sim ||
        (sim === best.sim && c.distanceM < best.distanceM))
    )
      best = { ...c, sim };
  }
  if (best) return { ...best, kind: "fuzzy" };

  // Exact address, but the point is far off: trust it only when unambiguous.
  if (!exact) return null;
  const far: Candidate[] = [];
  for (const [tmk, address] of exact) {
    const d = layer.distanceToTmk(tmk, lat, lon);
    if (d !== null && d <= FAR_MAX_M) far.push({ tmk, distanceM: d, address });
  }
  return far.length === 1 ? { ...far[0], kind: "address_far" } : null;
}

export function geocode(
  lat: number,
  lon: number,
  listingAddress: string | null,
  coordDecimals: number | null,
  layer: ParcelIndex,
  addresses: AddressIndex | null,
  opts: GeocodeOptions,
): GeocodeHit | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const inside = layer.locate(lat, lon, 0);

  const key =
    addresses && opts.addressRadiusM > 0
      ? normalizeAddress(listingAddress)
      : null;
  if (key) {
    const radius = searchRadiusM(opts.addressRadiusM, coordDecimals);
    const hit = byAddress(key, lat, lon, radius, layer, addresses!);
    if (hit)
      return {
        tmk: hit.tmk,
        match: hit.tmk === inside?.tmk ? "within_addr" : hit.kind,
        distanceM: hit.distanceM,
        address: hit.address,
      };
  }

  if (inside) return { ...inside, match: "within", address: null };
  if (opts.maxNearestM > 0) {
    const near = layer.locate(lat, lon, opts.maxNearestM);
    if (near) return { ...near, match: "nearest", address: null };
  }
  return null;
}
