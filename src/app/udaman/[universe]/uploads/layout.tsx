import { UploadLayout } from "@/components/uploads/upload-layout";
import { UploadTabs } from "@/components/uploads/upload-tabs";
import { isDbedt, isHhf } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/dal";
import { getReadableResources } from "@/lib/auth/readable-resources";
import { hasFullAccess } from "@/lib/auth/roles";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, universe } = await getCurrentUserContext();
  const readableResources = await getReadableResources(role);

  // Defense in depth behind the middleware: only admin/dev, DBEDT external
  // uploaders, and HHF factbook maintainers get past this layout.
  if (
    !hasFullAccess(role) &&
    !isDbedt(role, universe) &&
    !isHhf(role, universe)
  ) {
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
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-0 sm:p-4 sm:pt-0">
      <UploadTabs role={role} readableResources={readableResources} />
      <UploadLayout>{children}</UploadLayout>
    </div>
  );
}
