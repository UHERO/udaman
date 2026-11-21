import { getSession } from "@/lib/auth/dal";

import { DocsShell } from "../docs-shell";

/**
 * Public docs, readable without a udaman login (see PUBLIC_PAGES in
 * src/proxy.ts). A signed-in reader gets the usual docs sidebar; anyone else
 * gets the page on its own.
 */
export default async function PublicDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) return <DocsShell session={session}>{children}</DocsShell>;
  return (
    <div className="bg-background min-h-screen">
      <header className="border-b border-stone-200 px-4 py-3 dark:border-stone-800">
        <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
          UHERO
        </span>
      </header>
      <main className="mx-auto max-w-6xl pt-6">{children}</main>
    </div>
  );
}
