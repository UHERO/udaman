import { cn } from "@/lib/utils";

export const H1 = ({
  className,
  children,
  ...props
}: React.ComponentProps<"h1">) => (
  <h1
    className={cn(
      "text-7xl font-bold tracking-tight text-stone-700",
      className
    )}
    {...props}
  >
    {children}
  </h1>
);

export const H2 = ({
  className,
  children,
  ...props
}: React.ComponentProps<"h2">) => (
  <h2
    className={cn("mb-7 text-5xl font-bold text-stone-700", className)}
    {...props}
  >
    {children}
  </h2>
);

export const Lead = ({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) => (
  <p className={cn("font-mono text-4xl", className)} {...props}>
    {children}
  </p>
);
