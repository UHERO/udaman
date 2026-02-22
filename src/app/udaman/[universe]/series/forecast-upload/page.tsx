import ForecastUploadForm from "@/components/forecast/forecast-upload-form";
import { H1, Lead } from "@/components/typography";

export default function ForecastUploadPage() {
  return (
    <div className="p-8">
      <H1>Forecast Series Upload</H1>
      <Lead className="mt-4">
        Upload a report_table CSV to create or update FC forecast series.
      </Lead>
      <div className="mt-6 max-w-4xl">
        <ForecastUploadForm />
      </div>
    </div>
  );
}
