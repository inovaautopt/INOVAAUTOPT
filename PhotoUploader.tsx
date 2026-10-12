"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/components/admin/ActionForm";
import { initialState } from "@/components/admin/ActionForm";
import { cn } from "@/lib/cn";

/** Lado maior depois de reduzir. O servidor gera variantes até 1600 px, por isso 2400 px chega. */
const MAX_SIDE = 2400;
/** Abaixo do limite de pedidos das server actions (ver next.config.ts) e do limite de 4,5 MB da Vercel. */
const MAX_SEND_BYTES = 3.5 * 1024 * 1024;

/**
 * Reduz e converte a fotografia para JPEG no navegador. As fotografias de telemóvel têm muitas
 * vezes 4–12 MB, acima do limite de tamanho de cada pedido ao servidor; assim cada envio fica
 * com algumas centenas de KB. Se o navegador não conseguir ler o ficheiro (ex.: HEIC no Chrome),
 * devolve o original e o servidor trata dele.
 */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    let quality = 0.88;
    let blob: Blob | null = null;
    while (quality >= 0.5) {
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (!blob || blob.size <= MAX_SEND_BYTES) break;
      quality -= 0.12;
    }
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function PhotoUploader({
  vehicleId,
  action,
}: {
  vehicleId: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(input.current?.files ?? []);
    if (files.length === 0) {
      setResult({ ok: false, message: "Escolhe pelo menos uma fotografia." });
      return;
    }
    setBusy(true);
    setResult(null);
    let done = 0;
    const errors: string[] = [];
    for (const [i, original] of files.entries()) {
      setProgress(`A enviar ${i + 1} de ${files.length}…`);
      try {
        const file = await shrink(original);
        if (file.size > MAX_SEND_BYTES) {
          errors.push(`${original.name}: demasiado grande (${(file.size / 1048576).toFixed(1)} MB). Converte para JPEG e tenta de novo.`);
          continue;
        }
        const fd = new FormData();
        fd.set("vehicleId", vehicleId);
        fd.append("photos", file);
        const r = await action(initialState, fd);
        if (r.ok) done++;
        else errors.push(`${original.name}: ${r.message ?? "falhou"}`);
      } catch (err) {
        errors.push(`${original.name}: ${(err as Error).message || "erro de ligação"}`);
      }
    }
    setBusy(false);
    setProgress(null);
    if (done > 0 && input.current) input.current.value = "";
    setResult({
      ok: errors.length === 0,
      message: `${done} fotografia(s) carregada(s).` + (errors.length ? ` Falharam ${errors.length}: ${errors.slice(0, 3).join(" · ")}` : ""),
    });
    if (done > 0) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="field-label" htmlFor="photos">Do computador ou telemóvel</label>
      <input
        ref={input}
        id="photos"
        name="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        disabled={busy}
        className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-2 file:font-semibold file:text-white"
      />
      {result && (
        <p role={result.ok ? "status" : "alert"} className={cn("rounded-[var(--radius-sm)] p-3 text-sm font-semibold", result.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
          {result.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? progress : "Carregar fotografias"}
        </button>
      </div>
    </form>
  );
}
