import Link from "next/link";
import { Megaphone } from "lucide-react";

const sections = [
  {
    title: "Pre-Release Form",
    description:
      "Sign-off record filed by the lead author before a work product is released.",
    href: "/comms/pub-form",
    icon: Megaphone,
  },
];

export default function CommsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">
          Comms
        </h1>
        <p className="text-muted-foreground text-sm">
          Communications and pre-release review.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="hover:border-ublue/50 hover:bg-accent/40 rounded-lg border p-4 transition-colors"
          >
            <section.icon className="text-ublue mb-2 h-5 w-5" />
            <div className="font-medium">{section.title}</div>
            <p className="text-muted-foreground text-sm">
              {section.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
