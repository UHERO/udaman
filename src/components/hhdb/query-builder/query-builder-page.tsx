"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type { QueryResult } from "@catalog/collections/hhdb-query-builder-collection";
import {
  decodeSpec,
  encodeSpec,
  LIMITS,
  type Limit,
  type QuerySchema,
  type QuerySpec,
} from "@catalog/utils/hhdb-query-builder/spec";
import { Loader2, Maximize2, Minimize2, Play, RotateCcw } from "lucide-react";

import { runHhdbQueryBuilder } from "@/actions/hhdb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFullWidth } from "@/hooks/use-full-width";

import { ColumnPicker } from "./column-picker";
import { FilterList } from "./filter-list";
import { describeOutputs, initialSpec } from "./helpers";
import { ResultsTable } from "./results-table";
import { SummarizePanel } from "./summarize-panel";
import { TablePicker } from "./table-picker";

const NONE = "__none__";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[9rem_1fr] md:gap-6">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface QueryBuilderPageProps {
  schema: QuerySchema;
}

export function QueryBuilderPage({ schema }: QueryBuilderPageProps) {
  const searchParams = useSearchParams();
  const { fullWidth, toggleWidth } = useFullWidth();
  const [spec, setSpec] = useState<QuerySpec>(
    () => decodeSpec(searchParams.get("q")) ?? initialSpec(schema),
  );
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const autoRan = useRef(false);

  // Keep the URL shareable without triggering a server round-trip per edit.
  useEffect(() => {
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("q", encodeSpec(spec));
      window.history.replaceState(window.history.state, "", url);
    }, 250);
    return () => clearTimeout(t);
  }, [spec]);

  const run = useCallback(
    (s: QuerySpec) => {
      startTransition(async () => {
        const res = await runHhdbQueryBuilder(s);
        if (res.ok) {
          setResult(res.result);
          setError(null);
        } else {
          setError(res.error);
        }
      });
    },
    [startTransition],
  );

  // A pasted link runs itself once.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (searchParams.get("q")) run(spec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outputs = describeOutputs(spec, schema);
  const sortKey =
    spec.sort && outputs.some((o) => o.key === spec.sort!.key)
      ? spec.sort.key
      : NONE;

  const reset = () => {
    setSpec(initialSpec(schema));
    setResult(null);
    setError(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Query Builder</h1>
          <p className="text-muted-foreground text-sm">
            Pick tables, columns and filters; every table joins on TMK. Results
            are capped, so use Summarize or the CSV export for anything bigger.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={toggleWidth}
          title={fullWidth ? "Constrain width" : "Full width"}
        >
          {fullWidth ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="space-y-5 pt-6">
          <Section
            title="Tables"
            hint="Primary table, plus any to join on TMK."
          >
            <TablePicker schema={schema} spec={spec} onChange={setSpec} />
          </Section>
          <Separator />
          {!spec.summarize.enabled && (
            <>
              <Section title="Columns" hint="What each result row shows.">
                <ColumnPicker schema={schema} spec={spec} onChange={setSpec} />
              </Section>
              <Separator />
            </>
          )}
          <Section
            title="Filters"
            hint="Only rows matching every filter are returned."
          >
            <FilterList schema={schema} spec={spec} onChange={setSpec} />
          </Section>
          <Separator />
          <Section title="Summarize" hint="Optional grouping and totals.">
            <SummarizePanel schema={schema} spec={spec} onChange={setSpec} />
          </Section>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-3 border-t pt-4">
          <span className="text-muted-foreground text-xs">Sort by</span>
          <Select
            value={sortKey}
            onValueChange={(key) =>
              setSpec((s) =>
                key === NONE
                  ? { ...s, sort: undefined }
                  : { ...s, sort: { key, dir: s.sort?.dir ?? "asc" } },
              )
            }
          >
            <SelectTrigger size="sm" className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Database order</SelectItem>
              {outputs.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {spec.sort && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={spec.sort.dir}
              onValueChange={(dir) =>
                dir &&
                setSpec((s) =>
                  s.sort
                    ? { ...s, sort: { ...s.sort, dir: dir as "asc" | "desc" } }
                    : s,
                )
              }
            >
              <ToggleGroupItem value="asc" className="px-2 text-xs">
                Asc
              </ToggleGroupItem>
              <ToggleGroupItem value="desc" className="px-2 text-xs">
                Desc
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          <span className="text-muted-foreground ml-2 text-xs">Limit</span>
          <Select
            value={String(spec.limit)}
            onValueChange={(v) =>
              setSpec((s) => ({ ...s, limit: Number(v) as Limit }))
            }
          >
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMITS.map((l) => (
                <SelectItem key={l} value={String(l)}>
                  {l.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={pending}
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <Button size="sm" onClick={() => run(spec)} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Run query
            </Button>
          </div>
        </CardFooter>
      </Card>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {result ? (
        <ResultsTable result={result} loading={pending} />
      ) : (
        !error && (
          <div className="text-muted-foreground rounded-md border border-dashed px-4 py-10 text-center text-sm">
            Build a query above and press{" "}
            <span className="font-medium">Run query</span>.
          </div>
        )
      )}
    </div>
  );
}
