/**
 * NOAA buoy + tide + wind data fetching with singleton cache.
 * Waves: NDBC buoy 51211 (Pearl Harbor entrance) — wave-only, no anemometer
 * Tide + wind: CO-OPS station 1612340 (Honolulu Harbor)
 */

export type SurfData = {
  waveHeight: number; // meters (WVHT)
  dominantPeriod: number; // seconds (DPD)
  meanDirection: number; // degrees (MWD)
  windSpeed: number; // m/s (WSPD)
  windDirection: number; // degrees (WDIR)
  waterTemp: number; // °C (WTMP)
  tide: number; // feet
  fetchedAt: Date;
};

const BUOY_URL = "https://www.ndbc.noaa.gov/data/realtime2/51211.txt";
const TIDE_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=1612340&product=water_level&datum=STND&time_zone=gmt&units=english&format=json";
const WIND_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=1612340&product=wind&time_zone=gmt&units=metric&format=json";

// Single caching layer, in-process. The fetches below use `no-store` so
// Next's data cache doesn't add a second, stale-while-revalidate layer.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cache: { data: SurfData; fetchedAt: number } | null = null;

/**
 * Parse the NDBC buoy text file. Columns are whitespace-delimited.
 * Header row 0: column names, row 1: units. Data rows start at index 2.
 * Missing values are represented as "MM".
 */
function parseBuoyRows(text: string): {
  waveHeight: number;
  dominantPeriod: number;
  meanDirection: number;
  windSpeed: number;
  windDirection: number;
  waterTemp: number;
} {
  const lines = text.trim().split("\n");
  if (lines.length < 3) throw new Error("Buoy data: not enough rows");

  // Column indices (0-based):
  // 0:YY 1:MM 2:DD 3:hh 4:mm 5:WDIR 6:WSPD 7:GST 8:WVHT 9:DPD 10:APD 11:MWD
  // 12:PRES 13:ATMP 14:WTMP 15:DEWP 16:VIS 17:PTDY 18:TIDE
  const COL = { WDIR: 5, WSPD: 6, WVHT: 8, DPD: 9, MWD: 11, WTMP: 14 };

  // Average the most recent ~2h of readings. The window is anchored to the
  // newest row in the file, NOT wall-clock time: NDBC posts 30–60 min behind
  // real time and the file can be cached on top of that, so a wall-clock
  // cutoff would sometimes exclude every row and average nothing (all zeros).
  let windowStart: Date | null = null;

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const key of Object.keys(COL)) {
    sums[key] = 0;
    counts[key] = 0;
  }

  // Data rows start at index 2
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].trim().split(/\s+/);
    if (cols.length < 15) continue;

    // Parse row timestamp
    const year = parseInt(cols[0]);
    const month = parseInt(cols[1]) - 1;
    const day = parseInt(cols[2]);
    const hour = parseInt(cols[3]);
    const minute = parseInt(cols[4]);
    const rowDate = new Date(Date.UTC(year, month, day, hour, minute));

    if (isNaN(rowDate.getTime())) continue;
    if (!windowStart) {
      windowStart = new Date(rowDate.getTime() - 2 * 60 * 60 * 1000);
    }
    if (rowDate < windowStart) break; // rows are newest-first

    for (const [key, idx] of Object.entries(COL)) {
      const val = cols[idx];
      if (val !== "MM") {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          sums[key] += num;
          counts[key]++;
        }
      }
    }
  }

  const avg = (key: string) => (counts[key] > 0 ? sums[key] / counts[key] : 0);
  if (counts.WVHT === 0) throw new Error("Buoy data: no recent wave readings");

  return {
    waveHeight: avg("WVHT"),
    dominantPeriod: avg("DPD"),
    meanDirection: avg("MWD"),
    windSpeed: avg("WSPD"),
    windDirection: avg("WDIR"),
    waterTemp: avg("WTMP"),
  };
}

async function fetchBuoyData() {
  const res = await fetch(BUOY_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Buoy fetch failed: ${res.status}`);
  const text = await res.text();
  return parseBuoyRows(text);
}

async function fetchTideData(): Promise<number> {
  const res = await fetch(TIDE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Tide fetch failed: ${res.status}`);
  const json = await res.json();
  const v = json?.data?.[0]?.v;
  return v != null ? parseFloat(v) : 0;
}

/**
 * Latest Honolulu Harbor wind (m/s, degrees). Returns null when unavailable —
 * wind is a nice-to-have for the forecast, not a reason to hide it.
 */
async function fetchWindData(): Promise<{
  windSpeed: number;
  windDirection: number;
} | null> {
  try {
    const res = await fetch(WIND_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const row = json?.data?.[0];
    const s = parseFloat(row?.s);
    const d = parseFloat(row?.d);
    if (isNaN(s) || isNaN(d)) return null;
    return { windSpeed: s, windDirection: d };
  } catch {
    return null;
  }
}

export async function getSurfData(): Promise<SurfData> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const [buoy, tide, wind] = await Promise.all([
    fetchBuoyData(),
    fetchTideData(),
    fetchWindData(),
  ]);

  // 51211 has no anemometer, so its wind columns are "MM" (→ 0 here). Prefer
  // the harbor station; fall back to the buoy only if it ever reports wind.
  const data: SurfData = {
    ...buoy,
    ...(wind ?? {}),
    tide,
    fetchedAt: new Date(),
  };

  cache = { data, fetchedAt: now };
  return data;
}
