"use server";
import { redirect } from "next/navigation";
import { cancelSavedSearch, confirmSavedSearch } from "@/server/saved-searches";

export async function confirmAction(formData: FormData) {
  const t = String(formData.get("token") ?? "");
  const ok = t.length > 20 && (await confirmSavedSearch(t));
  redirect(`/alertas/confirmar?estado=${ok ? "ok" : "erro"}`);
}

export async function cancelAction(formData: FormData) {
  const t = String(formData.get("token") ?? "");
  const ok = t.length > 20 && (await cancelSavedSearch(t));
  redirect(`/alertas/cancelar?estado=${ok ? "ok" : "erro"}`);
}
