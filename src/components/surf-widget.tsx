import { getSurfForecast } from "@/lib/surf/surf-forecast";

const M_TO_FT = 3.28084;
const REEF_BREAKING_MULT = 1.3; // deep water → breaking face on gentle reef
const HAWAIIAN_SCALE = 0.5; // Hawaiians measure back of wave ≈ half the face

function labelColor(label: string): string {
  switch (label) {
    case "Epic":
    case "Firing":
      return "text-emerald-300";
    case "Fun":
      return "text-green-300";
    case "Fair":
      return "text-yellow-300";
    case "Poor":
    case "Flat":
      return "text-red-300";
    default:
      return "text-white";
  }
}

function directionLabel(deg: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
}

export async function SurfWidget() {
  let forecast;
  try {
    forecast = await getSurfForecast();
  } catch {
    return null; // Silently fail — don't break the login page
  }

  const { label, factors } = forecast;
  const faceFt = factors.swellHeight * REEF_BREAKING_MULT * M_TO_FT;
  const hawaiianFt = faceFt * HAWAIIAN_SCALE;
  const lo = Math.floor(hawaiianFt);
  const hi = Math.ceil(hawaiianFt + 0.5);
  const waterTempF = ((factors.waterTemp * 9) / 5 + 32).toFixed(0);

  return (
    <div className="absolute right-6 bottom-6 z-10 w-56 rounded-xl border border-white/20 bg-black/30 p-4 text-white backdrop-blur-md">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs tracking-wide text-balance text-white/60 uppercase">
          UHERO South Shore Surf Forecast
        </span>
        <span className={`my-auto text-lg font-bold ${labelColor(label)}`}>
          {label}
        </span>
      </div>
      <div className="space-y-1 text-xs text-white/80">
        <div className="flex justify-between">
          <span>Waves</span>
          <span>
            {lo}-{hi}ft @ {factors.swellPeriod.toFixed(0)}s
          </span>
        </div>
        <div className="flex justify-between">
          <span>Direction</span>
          <span>
            {directionLabel(factors.swellDir)} ({factors.swellDir.toFixed(0)}°)
          </span>
        </div>
        <div className="flex justify-between">
          <span>Wind</span>
          <span>{factors.windDesc}</span>
        </div>
        {/* <div className="flex justify-between">
          <span>Tide</span>
          <span>{factors.tide.toFixed(1)}ft</span>
        </div>
        <div className="flex justify-between">
          <span>Water</span>
          <span>{waterTempF}°F</span>
        </div> */}
      </div>
      <div className="mt-2 text-right text-[10px] text-white/40">
        NOAA Buoy 51211
      </div>
    </div>
  );
}
