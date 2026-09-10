import { AnalyzerTabs } from "@/components/series/analyzer/analyzer-tabs";
import { SeriesLayout } from "@/components/series/series-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-0 sm:p-4 sm:pt-0">
      <AnalyzerTabs />
      <SeriesLayout>{children}</SeriesLayout>
    </div>
  );
}
