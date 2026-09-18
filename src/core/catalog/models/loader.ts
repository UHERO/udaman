import type { Universe } from "../types/shared";
import Series from "./series";

export type LoaderAttrs = {
  id: number;
  series_id?: number | null;
  universe?: string;
  eval?: string | null;
  description?: string | null;
  dependencies?: string | null;
  color?: string | null;
  priority?: number | null;
  scale?: string | null;
  disabled?: boolean | number | null;
  pseudo_history?: boolean | number | null;
  clear_before_load?: boolean | number | null;
  reload_nightly?: boolean | number | null;
  presave_hook?: string | null;
  last_run_at?: Date | string | null;
  last_run_in_seconds?: number | null;
  last_error?: string | null;
  last_error_at?: Date | string | null;
  runtime?: number | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type LoaderType =
  | "pseudo_history"
  | "api"
  | "forecast"
  | "download"
  | "history"
  | "manual"
  | "other";

/** Plain-object shape returned by Loader.toJSON(), safe to pass across the server/client boundary. */
export type SerializedLoader = ReturnType<Loader["toJSON"]>;

class Loader {
  readonly id: number;
  seriesId: number | null;
  readonly universe: Universe;
  eval: string | null;
  description: string | null;
  dependencies: string[];
  color: string | null;
  priority: number;
  scale: string;
  disabled: boolean;
  pseudoHistory: boolean;
  clearBeforeLoad: boolean;
  reloadNightly: boolean;
  presaveHook: string | null;
  lastRunAt: Date | null;
  lastRunInSeconds: number | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  runtime: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: LoaderAttrs) {
    this.id = attrs.id;
    this.seriesId = attrs.series_id ?? null;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.eval = attrs.eval ?? null;
    this.description = attrs.description ?? null;
    this.dependencies = Loader.parseDependencies(attrs.dependencies ?? null);
    this.color = attrs.color ?? null;
    this.priority = attrs.priority ?? 50;
    this.scale = attrs.scale ?? "1.0";
    this.disabled = Boolean(attrs.disabled);
    this.pseudoHistory = Boolean(attrs.pseudo_history);
    this.clearBeforeLoad = Boolean(attrs.clear_before_load);
    this.reloadNightly = Boolean(attrs.reload_nightly);
    this.presaveHook = attrs.presave_hook ?? null;
    this.lastRunAt = attrs.last_run_at
      ? new Date(attrs.last_run_at as string | Date)
      : null;
    this.lastRunInSeconds = attrs.last_run_in_seconds ?? null;
    this.lastError = attrs.last_error ?? null;
    this.lastErrorAt = attrs.last_error_at
      ? new Date(attrs.last_error_at as string | Date)
      : null;
    this.runtime = attrs.runtime ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  get loaderType(): LoaderType {
    return Loader.getLoaderType(this.eval ?? "", this.pseudoHistory);
  }

  get generatedDescription(): string {
    return Loader.generateDescriptionFromEval(this.eval ?? "");
  }

  static getLoaderType(evalExpr: string, pseudoHistory = false): LoaderType {
    if (pseudoHistory) return "pseudo_history";
    if (/load_api/.test(evalExpr)) return "api";
    if (/forecast/i.test(evalExpr)) return "forecast";
    if (/load_from_download/.test(evalExpr)) return "download";
    if (/load_[a-z_]*from.*history/i.test(evalExpr)) return "history";
    if (/load_[a-z_]*from/i.test(evalExpr)) return "manual";
    return "other";
  }

  static getColorPalette(type: string): string[] {
    const palettes: Record<string, string[]> = {
      api: ["B2A1EA", "CDC8FE", "A885EF"],
      forecast: ["FFA94E", "FFA500"],
      download: ["A9BEF2", "C3DDF9", "6495ED"],
      manual: ["F9FF8B", "FBFFBD", "F0E67F"],
      history: ["CAAF8C", "DFC3AA", "B78E5C"],
      pseudo_history: ["FEB4AA"],
      other: ["9FDD8C", "D0F0C0", "88D3B2", "74C365"],
    };
    return palettes[type] || ["FFFFFF"];
  }

  /** Parse serialized YAML/JSON dependency field from DB */
  static parseDependencies(raw: string | null): string[] {
    if (!raw || raw.trim() === "---" || raw.includes("--- []")) {
      return [];
    }

    // Try JSON first
    if (raw.trim().startsWith("[")) {
      try {
        return JSON.parse(raw);
      } catch {
        // fall through to YAML parsing
      }
    }

    // Simple parser for YAML array format: "---\n- SERIES_NAME\n- SERIES_NAME2"
    const lines = raw.split("\n");
    const dependencies: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ")) {
        dependencies.push(trimmed.substring(2).trim());
      }
    }
    return dependencies;
  }

  /** Extract series name dependencies from text */
  static extractDependencies(description: string, evalExpr: string): string[] {
    const dependencies = new Set<string>();
    const text = `${description} ${evalExpr}`;
    const words = text.split(/\s+/);
    for (const word of words) {
      if (Series.isValidName(word)) {
        dependencies.add(word);
      }
    }
    return Array.from(dependencies);
  }

  /** Parse eval expression into human-readable description */
  static generateDescriptionFromEval(evalExpr: string): string {
    // Handle aggregation: "SERIES@GEO.FREQ".ts.aggregate(:frequency, :operation)
    const aggregateMatch = evalExpr.match(
      /^"([^"]+)"\.ts\.aggregate\(:(\w+),\s*:(\w+)\)/,
    );
    if (aggregateMatch) {
      const [, seriesName, , operation] = aggregateMatch;
      return `Aggregated as ${operation} from ${seriesName}`;
    }

    // Handle interpolation: "SERIES@GEO.FREQ".ts.fill_missing_months_linear
    const interpolateMatch = evalExpr.match(
      /^"([^"]+)"\.ts\.fill_missing_months_linear/,
    );
    if (interpolateMatch) {
      const [, seriesName] = interpolateMatch;
      return `Interpolated from ${seriesName}`;
    }

    // Handle file loading: "SERIES@GEO.FREQ".tsn.load_from("path")
    const loadFromMatch = evalExpr.match(
      /^"([^"]+)"\.tsn?\.load_from\("([^"]+)"\)/,
    );
    if (loadFromMatch) {
      const [, , filePath] = loadFromMatch;
      return `loaded from static file <${filePath}>`;
    }

    // Handle API loading: Series.load_api_bls_NEW("ID", "FREQ")
    const apiMatch = evalExpr.match(
      /Series\.load_api_(\w+)(?:_NEW)?\("([^"]+)",\s*"([^"]+)"\)/,
    );
    if (apiMatch) {
      const [, source] = apiMatch;
      return source
        ? `loaded data set from ${source.toUpperCase()} API with parameters shown`
        : "Source not found";
    }

    // Handle arithmetic: "SERIES1@GEO.FREQ".ts * number
    const multiplyMatch = evalExpr.match(/^"([^"]+)"\.ts\s*\*\s*([\d.]+)/);
    if (multiplyMatch) {
      const [, seriesName, multiplier] = multiplyMatch;
      return `${seriesName} * ${multiplier}`;
    }

    // Handle division: ("SERIES1@GEO.FREQ".ts) / ("SERIES2@GEO.FREQ".ts) * 100
    const divisionMatch = evalExpr.match(
      /\(\("([^"]+)"\.ts\)\s*\/\s*\("([^"]+)"\.ts\)\)\s*\*\s*([\d.]+)/,
    );
    if (divisionMatch) {
      const [, numerator, denominator, multiplier] = divisionMatch;
      return `((${numerator}) / (${denominator})) * ${multiplier}`;
    }

    // Handle simple series reference: "SERIES@GEO.FREQ".ts
    const simpleMatch = evalExpr.match(/^"([^"]+)"\.ts$/);
    if (simpleMatch) {
      const [, seriesName] = simpleMatch;
      return seriesName;
    }

    // Fallback: return the eval expression itself (cleaned up)
    return evalExpr.replace(/"/g, "").replace(/\.ts/g, "");
  }

  /** Whether this loader is a history or pseudo_history type */
  get isHistory(): boolean {
    return (
      this.loaderType === "history" || this.loaderType === "pseudo_history"
    );
  }

  /** Recompute dependencies from description and eval (in-memory only) */
  refreshDependencies(): void {
    this.dependencies = Loader.extractDependencies(
      this.description ?? "",
      this.eval ?? "",
    );
  }

  /** Strip whitespace from string fields, convert blank strings to null (pre-save hook) */
  cleanWhitespace(): void {
    const stringFields = [
      "eval",
      "description",
      "color",
      "scale",
      "presaveHook",
      "lastError",
    ] as const;
    for (const field of stringFields) {
      const value = this[field];
      if (typeof value === "string") {
        const trimmed = value.trim();
        (this as Record<string, unknown>)[field] =
          trimmed === "" ? null : trimmed;
      }
    }
  }

  /** Extract base year from eval string containing "rebase" */
  baseYearFromEval(): number | null {
    const evalStr = this.eval;
    if (!evalStr) return null;

    if (/rebase/.test(evalStr)) {
      const yearMatch = evalStr.match(/rebase\(["']?(\d+)/);
      if (yearMatch) {
        return parseInt(yearMatch[1], 10);
      }
      // If rebase is present but no explicit year, caller must resolve via DB
      return null;
    }
    // Dependencies base_year lookup requires DB — caller handles
    return null;
  }

  /**
   * Validate seasonal adjustment compatibility between a series and its dependencies.
   * Returns an error message string if invalid, or null if valid.
   * Static so collection can pass in resolved dependency data without the model needing DB access.
   */
  static validateSeasonalAdjustmentCompatibility(opts: {
    currentSA: string | null;
    dependencies: Array<{
      name: string;
      seasonalAdjustment: string | null;
      universe: string;
    }>;
  }): string | null {
    const { currentSA, dependencies } = opts;
    if (!currentSA) return null;

    for (const dep of dependencies) {
      const depSA = dep.seasonalAdjustment;
      if (!depSA) continue;

      if (
        currentSA === "not_seasonally_adjusted" &&
        depSA === "seasonally_adjusted"
      ) {
        // NS loading from SA — check if NS version name would exist
        const match = dep.name.match(/^(.+?)(@.+)$/);
        if (match) {
          const comparableName = `${match[1]}NS${match[2]}`;
          return (
            `NS series should load from NS series (not SA): ` +
            `should use ${comparableName} (NS) instead of ${dep.name} (SA)`
          );
        }
      } else if (
        currentSA === "seasonally_adjusted" &&
        depSA === "not_seasonally_adjusted"
      ) {
        // SA loading from NS — check if SA version name would exist
        const match = dep.name.match(/^(.+?)NS(@.+)$/);
        if (match) {
          const comparableName = `${match[1]}${match[2]}`;
          return (
            `SA series should load from SA series (not NS): ` +
            `should use ${comparableName} (SA) instead of ${dep.name} (NS)`
          );
        }
      } else if (
        currentSA === "not_applicable" &&
        depSA === "seasonally_adjusted"
      ) {
        // N/A loading from SA — check if NS version name would exist
        const match = dep.name.match(/^(.+?)(@.+)$/);
        if (match) {
          const comparableName = `${match[1]}NS${match[2]}`;
          return (
            `N/A series should load from NS series (not SA): ` +
            `should use ${comparableName} (NS) instead of ${dep.name} (SA)`
          );
        }
      }
    }
    return null;
  }

  toString(): string {
    return `Loader#${this.id} [${this.loaderType}] ${this.universe}`;
  }

  toJSON() {
    return {
      id: this.id,
      seriesId: this.seriesId,
      universe: this.universe,
      eval: this.eval,
      description: this.description,
      dependencies: this.dependencies,
      color: this.color,
      priority: this.priority,
      scale: this.scale,
      disabled: this.disabled,
      pseudoHistory: this.pseudoHistory,
      clearBeforeLoad: this.clearBeforeLoad,
      reloadNightly: this.reloadNightly,
      presaveHook: this.presaveHook,
      lastRunAt: this.lastRunAt,
      lastRunInSeconds: this.lastRunInSeconds,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
      runtime: this.runtime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export default Loader;
