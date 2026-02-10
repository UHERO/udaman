import React from "react";
import Link from "next/link";
import { SourceMapNode } from "@catalog/types/shared";
import { dateTimestamp } from "@catalog/utils/time";

import { cn } from "@/lib/utils";

import { getColor } from "../helpers";

interface SourceMapProps {
  node: SourceMapNode;
  universe: string;
  depth?: number;
}

/** Recursive table for displaying Series heirarchy. Faithful recreation of the previous version.
 * I imagine this could be reimagined a bit more elegantly.
 */
const SourceMap: React.FC<SourceMapProps> = ({ node, universe, depth = 0 }) => {
  const { dataSource } = node;
  const seriesHref = `/udaman/${universe}/series/${node.dataSource.series_id}`;

  return (
    <tr>
      <td className="border border-gray-300 bg-gray-50 p-3 align-top">
        <Link
          href={seriesHref}
          className="text-sm font-bold text-slate-700 hover:underline"
        >
          {node.name}
        </Link>
      </td>
      <td
        className={cn(
          "min-w-2xs border border-gray-300 p-2 align-top",
          dataSource.disabled && "opacity-50",
          getColor(dataSource.color)
        )}
      >
        <div className="space-y-1">
          <div className="text-sm font-semibold text-gray-900">
            {dataSource.description || "No description"}
          </div>
          <div className="space-y-0.5 text-xs text-gray-600">
            <div>Last Run: {dateTimestamp(dataSource.last_run_in_seconds)}</div>
            <div>{`missing: ${dataSource.aremos_missing}`}</div>
            <div>{`diff: ${dataSource.aremos_diff}`}</div>
            {dataSource.last_error && (
              <div className="font-medium text-red-600">
                Error: {dataSource.last_error}
              </div>
            )}
          </div>
        </div>
      </td>
      {node.children.length > 0 && (
        <td className="border border-gray-300 bg-gray-50 p-0">
          <table className="w-full border-collapse">
            <tbody>
              {node.children.map((child, index) => (
                <SourceMap
                  key={`${child.dataSource.id}-${child.name}-${index}`}
                  node={child}
                  universe={universe}
                  depth={depth + 1}
                />
              ))}
            </tbody>
          </table>
        </td>
      )}
    </tr>
  );
};

interface SourceMapTableProps {
  data: SourceMapNode[];
  universe: string;
  title?: string;
}

export function SourceMapTable({
  data,
  universe,
  title = "Source Map",
}: SourceMapTableProps) {
  if (data === undefined || data === null || data.length === 0) {
    return null;
  }
  const rootSeries = data.length > 0 ? data[0]?.name : "N/A";
  const maxDepth = Math.max(...data.map((node) => getMaxDepth(node)));
  const nodeCount = data.reduce((sum, node) => sum + countNodes(node), 0);

  return (
    <div className="my-5">
      <h3 className="mb-4 font-semibold text-gray-900">{title}</h3>
      <div className="overflow-x-auto border">
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
          <tbody>
            {data.map((node, index) => (
              <SourceMap
                key={`${node.dataSource.id}-${node.name}-${index}`}
                node={node}
                universe={universe}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        <span>Root Series: {rootSeries}</span>
        <span>Max Depth: {maxDepth}</span>
        <span>Total Nodes: {nodeCount}</span>
        <span>Data Sources: {data.length}</span>
      </div>
    </div>
  );
}

// Helper functions
function getMaxDepth(node: SourceMapNode): number {
  if (node.children.length === 0) return node.level;
  return Math.max(...node.children.map((child) => getMaxDepth(child)));
}

function countNodes(node: SourceMapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}
