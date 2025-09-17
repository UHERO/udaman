import { DataLoaderType, SeriesDependency } from "@shared/types/shared";

interface SourceMapNode {
  dataSource: DataLoaderType;
  dependencies: SeriesDependency[];
  children: SourceMapNode[];
  depth: number;
  color: string;
}

interface SourceMapRowProps {
  node: SourceMapNode;
  isRoot?: boolean;
}

function formatTimestamp(timestampSeconds: number): string {
  if (!timestampSeconds) return "Never";

  const date = new Date(timestampSeconds * 1000);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatValue(value: number | null | undefined, label: string): string {
  if (value === null || value === undefined) return `${label}: N/A`;
  return `${label}: ${value}`;
}

const SourceMapRow: React.FC<SourceMapRowProps> = ({ node }) => {
  const { dataSource, dependencies, children, color, depth } = node;
  console.log("SourceMapRow", node);
  return (
    <tr>
      {/* Data Source Cell - Always present (matches ERB first <td>) */}
      <td
        style={{
          backgroundColor: depth % 2 === 0 ? "white" : `#${color}`,
          padding: "8px",
          border: "1px solid #ccc",
          verticalAlign: "top",
          minWidth: "200px",
        }}
      >
        <div>
          <strong>{dataSource.description || "No description"}</strong>
          <br />
          <small>[{formatTimestamp(dataSource.last_run_in_seconds)}]</small>
        </div>
      </td>

      {/* Dependencies Cell - Only if there are dependencies (matches ERB second <td>) */}
      {dependencies.length > 0 && (
        <td style={{ padding: "0", border: "1px solid #ccc" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {dependencies.map((dep, i) => {
                // Find children data sources that belong to this specific dependency
                const depChildren = children.filter(
                  (child) =>
                    // This is a simplification - in real implementation you'd need proper mapping
                    true // For now, include all children for each dependency
                );

                return (
                  <tr key={`${dep.name}-${i}`}>
                    {/* Series Info Cell (matches ERB dependency series info) */}
                    <td
                      style={{
                        backgroundColor: `#${color}`,
                        padding: "8px",
                        border: "1px solid #ccc",
                        verticalAlign: "top",
                        minWidth: "150px",
                      }}
                    >
                      <div>
                        <a
                          href={`/series/${dep.id}`}
                          style={{
                            fontWeight: "bold",
                            color: "#0066cc",
                            textDecoration: "none",
                          }}
                        >
                          {dep.name}
                        </a>
                        <br />
                        <small>
                          {formatValue(dep.aremos_missing, "missing")}
                        </small>
                        <br />
                        <small>{formatValue(dep.aremos_diff, "diff")}</small>
                      </div>
                    </td>

                    {/* Nested Data Sources Cell (matches ERB recursive part) */}
                    {depChildren.length > 0 && (
                      <td style={{ padding: "0", border: "1px solid #ccc" }}>
                        <table
                          style={{ width: "100%", borderCollapse: "collapse" }}
                        >
                          <tbody>
                            {depChildren.map((child) => (
                              <SourceMapRow
                                key={`${child.dataSource.id}-${dep.name}`}
                                node={child}
                              />
                            ))}
                          </tbody>
                        </table>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </td>
      )}
    </tr>
  );
};

export const SourceMapTable: React.FC<{
  seriesId: number;
  nodes: SourceMapNode[];
}> = ({ seriesId, nodes }) => {
  if (nodes.length === 0) {
    return (
      <div style={{ padding: "20px", color: "#666" }}>
        No data sources found for this series.
      </div>
    );
  }
  console.log("NODES", nodes);
  return (
    <div style={{ margin: "20px 0" }}>
      <h3>Source Map</h3>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            border: "1px solid #ccc",
          }}
          className="operations-table"
        >
          <tbody>
            {/* Each top-level data source gets its own row (matches ERB outer loop) */}
            {nodes.map((node) => (
              <SourceMapRow key={node.dataSource.id} node={node} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
