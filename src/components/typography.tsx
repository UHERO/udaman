"use client";

import React, { useState } from "react";
import { Check, Copy, Info } from "lucide-react";

import { cn } from "@/lib/utils";

export const H1 = ({
  className,
  children,
  ...props
}: React.ComponentProps<"h1">) => (
  <h1
    className={cn(
      "text-7xl font-bold tracking-tight text-stone-700",
      className,
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

export const P = ({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) => (
  <p
    className={cn(
      "leading-7 text-stone-600 dark:text-stone-300 [&:not(:first-child)]:mt-4",
      className,
    )}
    {...props}
  >
    {children}
  </p>
);

export const CodeBlock = ({
  className,
  children,
  ...props
}: React.ComponentProps<"pre">) => (
  <pre
    className={cn(
      "my-4 overflow-x-auto rounded-lg bg-stone-900 p-4 text-sm leading-relaxed text-stone-100",
      className,
    )}
    {...props}
  >
    <code>{children}</code>
  </pre>
);

export const Callout = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "my-4 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
      className,
    )}
    {...props}
  >
    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
    <div>{children}</div>
  </div>
);

export const DetailBlock = ({
  className,
  items,
  ...props
}: React.ComponentProps<"dl"> & {
  items: { label: string; value: string | React.ReactElement }[];
}) => (
  <dl
    className={cn(
      "my-4 divide-y divide-stone-200 rounded-lg border border-stone-200 text-sm dark:divide-stone-700 dark:border-stone-700",
      className,
    )}
    {...props}
  >
    {items.map((item) => (
      <div
        key={item.label}
        className="flex items-baseline justify-between gap-4 px-4 py-2.5"
      >
        <dt className="shrink-0 font-medium text-stone-500 dark:text-stone-400">
          {item.label}
        </dt>
        <dd className="truncate font-mono text-stone-800 dark:text-stone-200">
          {item.value}
        </dd>
      </div>
    ))}
  </dl>
);

export const CopyBlock = ({
  className,
  children,
  text,
  ...props
}: React.ComponentProps<"div"> & { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group relative my-4 rounded-lg bg-stone-100 p-4 pr-12 font-mono text-sm dark:bg-stone-800",
        className,
      )}
      {...props}
    >
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 cursor-pointer rounded p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-stone-200 dark:hover:bg-stone-700"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-stone-500" />
        )}
      </button>
      {children}
    </div>
  );
};
