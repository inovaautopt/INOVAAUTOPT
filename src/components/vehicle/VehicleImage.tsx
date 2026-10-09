/* eslint-disable @next/next/no-img-element -- variantes WebP já geradas no carregamento */
import { mediaSrcSet, mediaUrl } from "@/lib/storage-url";
import { cn } from "@/lib/cn";
import { CarFront } from "lucide-react";

export function VehicleImage({
  path,
  alt,
  sizes,
  priority = false,
  className,
}: {
  path: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!path) {
    return (
      <div className={cn("flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-chrome-hi text-muted", className)}>
        <CarFront aria-hidden className="h-10 w-10" strokeWidth={1.4} />
        <span className="text-xs font-semibold">Fotografias em breve</span>
      </div>
    );
  }
  return (
    <img
      src={mediaUrl(path, 960)}
      srcSet={mediaSrcSet(path)}
      sizes={sizes}
      alt={alt}
      width={1600}
      height={1200}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn("aspect-[4/3] w-full bg-chrome-hi object-cover", className)}
    />
  );
}
