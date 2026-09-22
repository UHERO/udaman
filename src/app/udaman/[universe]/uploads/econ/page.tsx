import { getDbedtUploadsAction } from "@/actions/dbedt-upload";
import DbedtUploadPanel from "@/components/uploads/dbedt-upload-panel";

export default async function EconUploadPage() {
  const uploads = await getDbedtUploadsAction();

  return (
    <div>
      <h1 className="text-3xl font-bold">DBEDT Economic Data Warehouse</h1>
      <p className="text-muted-foreground text-sm">
        Upload a DBEDT economic indicators XLSX file to rebuild all DBEDT data.
      </p>
      <div className="mt-4 max-w-4xl">
        <DbedtUploadPanel initialUploads={uploads} />
      </div>
    </div>
  );
}
