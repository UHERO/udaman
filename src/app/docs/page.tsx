import Link from "next/link";
import { FunctionSquare, Server } from "lucide-react";

const docs = [
  {
    title: "IT Infrastructure",
    description:
      "Shared workstations, networking, and hardware documentation.",
    href: "/docs/it-infrastructure",
    icon: Server,
  },
  {
    title: "Loader Actions",
    description:
      "Reference for eval expressions: arithmetic, interpolation, API loading, and county sharing methods.",
    href: "/docs/loader-actions",
    icon: FunctionSquare,
  },
];

export default function DocsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div>
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">
          Docs
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Internal documentation for processes, infrastructure, and procedures.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="group rounded-lg border border-stone-200 p-5 transition-colors hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:hover:border-stone-600 dark:hover:bg-stone-800/50"
          >
            <div className="mb-2 flex items-center gap-2">
              <doc.icon className="h-5 w-5 text-stone-500 group-hover:text-stone-700 dark:group-hover:text-stone-300" />
              <h2 className="font-semibold text-stone-800 dark:text-stone-100">
                {doc.title}
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">{doc.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
