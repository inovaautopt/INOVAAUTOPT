"use client";
import { setPanelOpen } from "./consent-store";

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => setPanelOpen(true)}>
      Preferências de cookies
    </button>
  );
}
