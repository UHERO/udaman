import { AnalyzerTabs } from "@/components/series/analyzer/analyzer-tabs";
import { SeriesLayout } from "@/components/series/series-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AnalyzerTabs />
      <SeriesLayout>{children}</SeriesLayout>
    </div>
  );
}
