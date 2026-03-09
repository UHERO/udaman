import { UploadLayout } from "@/components/uploads/upload-layout";
import { UploadTabs } from "@/components/uploads/upload-tabs";
import { isDbedt, isInternalUser } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/dal";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, universe } = await getCurrentUserContext();

  if (!isDbedt(role, universe) && !isInternalUser(role, universe)) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Uploads</h1>
        <p className="text-muted-foreground mt-4">
          Access not authorized for your current role.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <UploadTabs role={role} universe={universe} />
      <UploadLayout>{children}</UploadLayout>
    </div>
  );
}
