/**
 * NOAA buoy + tide data fetching with singleton cache.
 * Buoy: Station 51211 (Kalaeloa)
 * Tide: Station 1612340 (Honolulu)
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

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

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

    if (rowDate < twoHoursAgo) break; // rows are newest-first

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
  const res = await fetch(BUOY_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Buoy fetch failed: ${res.status}`);
  const text = await res.text();
  return parseBuoyRows(text);
}

async function fetchTideData(): Promise<number> {
  const res = await fetch(TIDE_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Tide fetch failed: ${res.status}`);
  const json = await res.json();
  const v = json?.data?.[0]?.v;
  return v != null ? parseFloat(v) : 0;
}

export async function getSurfData(): Promise<SurfData> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const [buoy, tide] = await Promise.all([fetchBuoyData(), fetchTideData()]);

  const data: SurfData = {
    ...buoy,
    tide,
    fetchedAt: new Date(),
  };

  cache = { data, fetchedAt: now };
  return data;
}
