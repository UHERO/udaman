import { PreReleaseForm } from "@/components/comms/pre-release-form";
import { requireAuth } from "@/lib/auth/dal";

export default async function Page() {
  const session = await requireAuth();
  const authorName = session.user?.name || session.user?.email || "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">UHERO Pre-Release Form</h1>
        <p className="text-muted-foreground text-sm">
          Submitting this form records your sign-off and notifies the standard
          recipients.
        </p>
      </div>
      <PreReleaseForm mode="create" authorName={authorName} />
    </div>
  );
}
