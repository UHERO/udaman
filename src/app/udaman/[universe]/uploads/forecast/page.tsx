import ForecastUploadForm from "@/components/forecast/forecast-upload-form";

export default function ForecastUploadPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Forecast Series Upload</h1>
      <p className="text-muted-foreground text-sm">
        Upload a report_table CSV to create or update FC forecast series.
      </p>
      <div className="mt-4 max-w-4xl">
        <ForecastUploadForm />
      </div>
    </div>
  );
}
