import type { Universe } from "@catalog/types/shared";

import { getDbedtUploadsAction } from "@/actions/dbedt-upload";
import { getDvwUploadsAction } from "@/actions/dvw-upload";
import { H1, H2, Lead } from "@/components/typography";
import DbedtUploadPanel from "@/components/uploads/dbedt-upload-panel";
import DvwUploadPanel from "@/components/uploads/dvw-upload-panel";

export default async function UploadsPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;

  if (universe === "dbedt") {
    const uploads = await getDbedtUploadsAction();
    return (
      <div className="p-8">
        <H2>DBEDT Economic Data Warehouse Uploads</H2>
        <Lead className="text-md">
          Upload a DBEDT economic indicators XLSX file to rebuild all DBEDT
          data.
        </Lead>
        <div className="mt-6 max-w-4xl">
          <DbedtUploadPanel initialUploads={uploads} />
        </div>
      </div>
    );
  }

  if (universe === "uhero") {
    const uploads = await getDvwUploadsAction();
    return (
      <div className="p-8">
        <H2>DVW Tourism Data Warehouse Uploads</H2>
        <Lead className="text-md">
          Upload a DVW visitor statistics XLSX file to rebuild all DVW data.
        </Lead>
        <div className="mt-6 max-w-4xl">
          <DvwUploadPanel initialUploads={uploads} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <H1>Uploads</H1>
      <Lead className="mt-4">
        No upload process configured for {universe as Universe}.
      </Lead>
    </div>
  );
}
