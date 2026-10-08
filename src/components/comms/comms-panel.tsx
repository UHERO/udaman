import { cn } from "@/lib/utils";

/**
 * Solid-backed block for /comms pages. Dev and staging paint an env pattern
 * behind the app, so anything with text sits on one of these rather than on
 * the page itself. With a title, the header gets its own strip so adjacent
 * panels read as separate sections.
 */
export function CommsPanel({
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned controls in the header strip. */
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-card text-card-foreground overflow-hidden rounded-lg border shadow-xs",
        className,
      )}
    >
      {title && (
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * Labelled rule between major parts of a page (e.g. reviews above, the filed
 * form below). The label sits on a solid pill so it stays legible over the
 * env pattern.
 */
export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2" role="separator">
      <span className="bg-card text-muted-foreground shrink-0 rounded-full border px-3 py-1 text-xs font-medium tracking-[0.14em] uppercase shadow-xs">
        {label}
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}
