import { requireAuth } from "@/lib/auth/dal";

import { DocsShell } from "../docs-shell";

/** Internal docs: signed-in users only (the proxy also requires a session). */
export default async function InternalDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  return <DocsShell session={session}>{children}</DocsShell>;
}
