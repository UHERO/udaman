import { getSurfData } from "./noaa";

export type SurfForecast = {
  score: number;
  label: string;
  factors: {
    swellDir: number;
    swellHeight: number;
    swellPeriod: number;
    windDesc: string;
    tide: number;
    waterTemp: number;
  };
  fetchedAt: Date;
};

/**
 * Determine wind quality for the Waikiki south shore (facing ~180°).
 * Offshore = wind blowing from land to sea (roughly N, 315–45°)
 * Onshore = wind blowing from sea to land (roughly S, 135–225°)
 * Cross-shore = everything else
 */
function getWindQuality(windDir: number): string {
  // Normalize to 0-360
  const dir = ((windDir % 360) + 360) % 360;
  if (dir >= 315 || dir <= 45) return "Offshore";
  if (dir >= 135 && dir <= 225) return "Onshore";
  return "Cross-shore";
}

function directionLabel(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
}

export async function getSurfForecast(): Promise<SurfForecast> {
  const data = await getSurfData();

  let score = 0;

  // Swell direction (MWD) — south swell sweet spot
  if (data.meanDirection >= 160 && data.meanDirection <= 220) score += 2;
  if (data.meanDirection >= 170 && data.meanDirection <= 200) score += 1;

  // Size (WVHT in meters)
  if (data.waveHeight >= 2.5) score += 1;
  if (data.waveHeight >= 4) score += 1;

  // Wind quality
  const windQuality = getWindQuality(data.windDirection);
  if (windQuality === "Offshore") score += 2;
  else if (windQuality === "Cross-shore") score += 1;
  if (data.windSpeed > 15) score -= 1;

  // Tide (feet) — mid-tide is ideal
  if (data.tide >= 1 && data.tide <= 2.5) score += 1;

  // Label
  let label: string;
  if (data.waveHeight < 0.5) {
    label = "Flat";
    score = 0;
  } else if (score >= 6) {
    label = "Epic";
  } else if (score === 5) {
    label = "Firing";
  } else if (score >= 3) {
    label = "Fun";
  } else if (score === 2) {
    label = "Fair";
  } else {
    label = "Poor";
  }

  const windDesc = `${windQuality} ${directionLabel(data.windDirection)} ${data.windSpeed.toFixed(0)}m/s`;

  return {
    score,
    label,
    factors: {
      swellDir: data.meanDirection,
      swellHeight: data.waveHeight,
      swellPeriod: data.dominantPeriod,
      windDesc,
      tide: data.tide,
      waterTemp: data.waterTemp,
    },
    fetchedAt: data.fetchedAt,
  };
}
