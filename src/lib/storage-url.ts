/**
 * URLs públicas das fotografias das viaturas. As variantes são geradas no carregamento:
 *   <base>-480.webp, <base>-960.webp, <base>-1600.webp
 * Funciona no servidor e no cliente (só usa variáveis públicas).
 */
export const IMAGE_WIDTHS = [480, 960, 1600] as const;

function base(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const driver = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE;
  if (driver) return driver.replace(/\/$/, "");
  if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/vehicle-media`;
  return "/media/vehicle-media";
}

export function mediaUrl(storagePath: string, width: (typeof IMAGE_WIDTHS)[number] = 960): string {
  return `${base()}/${storagePath}-${width}.webp`;
}

export function mediaSrcSet(storagePath: string): string {
  return IMAGE_WIDTHS.map((w) => `${mediaUrl(storagePath, w)} ${w}w`).join(", ");
}
