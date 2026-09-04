import { UploadLayout } from "@/components/uploads/upload-layout";
import { UploadTabs } from "@/components/uploads/upload-tabs";
import { isDbedt, isHhf } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/dal";
import { hasFullAccess } from "@/lib/auth/roles";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, universe } = await getCurrentUserContext();

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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <UploadTabs role={role} />
      <UploadLayout>{children}</UploadLayout>
    </div>
  );
}
