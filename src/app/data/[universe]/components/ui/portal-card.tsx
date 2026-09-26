import { cn } from "@/lib/utils";

/**
 * White content card on the muted main area: square corners, soft drop
 * shadow, no border. Use for every content block (chart grid cells, tables,
 * stats, selectors bar).
 *
 *   <PortalCard>
 *     <PortalCardHeader title="Employment" subtitle="Thousands · SA" actions={…} />
 *     <PortalCardBody>…</PortalCardBody>
 *   </PortalCard>
 */
export function PortalCard({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="portal-card"
      className={cn(
        "bg-card text-card-foreground rounded-none shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.06)]",
        className,
      )}
      {...props}
    />
  );
}

export function PortalCardHeader({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-3 px-4 pt-3 pb-2",
        className,
      )}
    >
      <div className="min-w-0">
        {title && (
          <h3 className="text-foreground truncate text-sm leading-tight font-semibold">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      )}
    </header>
  );
}

export function PortalCardBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

/** Small uppercase section label used above cards / inside toolbars. */
export function PortalSectionLabel({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-muted-foreground text-[11px] font-semibold tracking-wider uppercase",
        className,
      )}
      {...props}
    />
  );
}
