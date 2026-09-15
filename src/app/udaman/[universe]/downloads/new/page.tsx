import { DownloadForm } from "@/components/downloads/download-form";

export default function NewDownloadPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <h1 className="text-3xl font-bold">New Download</h1>
      <DownloadForm />
    </div>
  );
}
