import { H1, Lead } from "@/components/typography";

export default function ForecastUploadPage() {
  return (
    <div className="p-8">
      <H1>Forecast Series Upload</H1>
      <Lead className="mt-4">Upload Forecast TSDs</Lead>
      <p className="text-muted-foreground mt-2 max-w-xl text-lg">
        Past forecast files currently exist in Google Drive. Configure this page
        to allow uploads so that Forecasts can be reviewed, charted, etc.
      </p>
    </div>
  );
}
