"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: [string, number][];
}

export function Sparkline({ data }: SparklineProps) {
  if (!data.length) return null;

  const chartData = data.map(([date, value]) => ({ date, value }));

  return (
    <ResponsiveContainer width={120} height={50}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke="red"
          strokeWidth={1}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
