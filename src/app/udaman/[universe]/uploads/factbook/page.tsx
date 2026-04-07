import FactbookUploadForm from "@/components/factbook/factbook-upload-form";

export default function FactbookUploadPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Factbook Upload</h1>
      <p className="text-muted-foreground text-sm">
        Load the Hawaii Housing Factbook pipe-separated data file into the HHF
        universe.
      </p>
      <div className="mt-4 max-w-4xl">
        <FactbookUploadForm />
      </div>
    </div>
  );
}
