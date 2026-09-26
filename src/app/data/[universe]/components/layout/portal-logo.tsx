"use client";

import Image from "next/image";

import { usePortalConfig } from "../../lib/portal-context";
import { UheroDataLogo } from "./uhero-data-logo";

/**
 * The universe's logo: an HTML wordmark when `config.logo.wordmark` is set,
 * else the configured image via next/image. Intrinsic size from config sets
 * the aspect ratio; CSS sizes it. Bitmaps (CCOM's JPEG) are resized by the
 * image optimizer; SVGs are served as-is.
 */
export function PortalLogo({
  className,
  wordmarkClassName,
  sizes,
  preload,
}: {
  /** Image classes. */
  className?: string;
  /** Wordmark classes (set its size via font-size). */
  wordmarkClassName?: string;
  sizes: string;
  preload?: boolean;
}) {
  const { logo } = usePortalConfig().config;
  if (logo.wordmark === "uhero-data") {
    return <UheroDataLogo className={wordmarkClassName} />;
  }
  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={logo.width}
      height={logo.height}
      sizes={sizes}
      preload={preload}
      className={className}
    />
  );
}
