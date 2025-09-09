import { cn } from "@/lib/utils";

export const H1 = ({
  className,
  children,
  ...props
}: React.ComponentProps<"h1">) => (
  <h1
    className={cn("text-7xl font-bold tracking-tight opacity-80", className)}
    {...props}
  >
    {children}
  </h1>
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
