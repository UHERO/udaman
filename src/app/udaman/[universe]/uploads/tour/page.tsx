import { getDvwUploadsAction } from "@/actions/dvw-upload";
import DvwUploadPanel from "@/components/uploads/dvw-upload-panel";

export default async function TourUploadPage() {
  const uploads = await getDvwUploadsAction();

  return (
    <div>
      <h1 className="text-3xl font-bold">DVW Tourism Data Warehouse</h1>
      <p className="text-muted-foreground text-sm">
        Upload a DVW visitor statistics XLSX file to rebuild all DVW data.
      </p>
      <div className="mt-4 max-w-4xl">
        <DvwUploadPanel initialUploads={uploads} />
      </div>
    </div>
  );
}
