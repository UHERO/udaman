import { PreReleaseForm } from "@/components/comms/pre-release-form";
import { PRE_RELEASE_RECIPIENTS } from "@/core/mailers/recipients";
import { requireAuth } from "@/lib/auth/dal";

export default async function Page() {
  const session = await requireAuth();
  const authorName = session.user?.name || session.user?.email || "";
  // Anyone can create a hawaii.edu account from the author picker; the role
  // decides whether other domains are allowed too.
  const currentRole = session.user?.role ?? "external";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">UHERO Pre-Release Form</h1>
        <p className="text-muted-foreground text-sm">
          Submitting this form records your sign-off and notifies the standard
          recipients.
        </p>
      </div>
      <PreReleaseForm
        mode="create"
        authorName={authorName}
        authorEmail={session.user?.email ?? null}
        currentRole={currentRole}
        standardRecipients={[...PRE_RELEASE_RECIPIENTS]}
      />
    </div>
  );
}
