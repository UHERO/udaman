import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Help-dialog figure. Without `src` it renders a neutral bordered box with
 * "Screenshot: <caption>" where the Angular help dialogs had a screenshot;
 * pass `src` (e.g. "/data-portal/help/category-chart-view.png", files in
 * public/data-portal/help/) to show the real image in the same box.
 *
 * `aspect` = width / height of the box (default 16:9); set it to the
 * screenshot's ratio when adding one so nothing is cropped.
 */
export function ScreenshotPlaceholder({
  caption,
  src,
  aspect = 16 / 9,
  className,
}: {
  caption: string;
  src?: string;
  aspect?: number;
  className?: string;
}) {
  return (
    <figure className={cn("space-y-1", className)}>
      <div
        className="relative w-full overflow-hidden border border-neutral-200 bg-neutral-50"
        style={{ aspectRatio: aspect }}
      >
        {src ? (
          <Image
            src={src}
            alt={`Screenshot: ${caption}`}
            fill
            sizes="(min-width: 640px) 624px, 100vw"
            className="object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center gap-2 px-3 text-center text-[11px] tracking-wider text-neutral-400 uppercase">
            <ImageIcon className="size-4 shrink-0" aria-hidden />
            <span>Screenshot: {caption}</span>
          </div>
        )}
      </div>
      {src && (
        <figcaption className="text-muted-foreground text-[11px]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
