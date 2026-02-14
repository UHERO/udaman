interface StatsTableProps {
  mean: number;
  median: number | null;
  standardDeviation: number;
  decimals: number;
}

export function StatsTable({ mean, median, standardDeviation, decimals }: StatsTableProps) {
  const fmt = (n: number | null) => (n != null ? n.toFixed(decimals) : "-");

  return (
    <table className="text-xs">
      <tbody>
        <tr>
          <td className="text-muted-foreground pr-3">Mean</td>
          <td className="font-mono">{fmt(mean)}</td>
        </tr>
        <tr>
          <td className="text-muted-foreground pr-3">Median</td>
          <td className="font-mono">{fmt(median)}</td>
        </tr>
        <tr>
          <td className="text-muted-foreground pr-3">Std Dev</td>
          <td className="font-mono">{fmt(standardDeviation)}</td>
        </tr>
      </tbody>
    </table>
  );
}
