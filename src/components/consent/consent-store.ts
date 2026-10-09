"use client";
import { useSyncExternalStore } from "react";

/**
 * Preferências de cookies do visitante. Sem opções pré-selecionadas: até haver escolha,
 * só funciona o estritamente necessário. Guardado no navegador (localStorage), com a versão
 * do texto apresentado — se a versão mudar, a escolha é pedida de novo.
 */
export interface ConsentState {
  version: string;
  analytics: boolean;
  marketing: boolean;
  external: boolean; // mapas e vídeos de terceiros
  decidedAt: string;
}

const KEY = "inova.consentimento.v1";
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheVal: ConsentState | null = null;
let panelOpen = false;
const panelListeners = new Set<() => void>();

function read(): ConsentState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = cacheRaw ?? null;
  }
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  try {
    cacheVal = raw ? (JSON.parse(raw) as ConsentState) : null;
  } catch {
    cacheVal = null;
  }
  return cacheVal;
}

export function saveConsent(c: Omit<ConsentState, "decidedAt">) {
  const value: ConsentState = { ...c, decidedAt: new Date().toISOString() };
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    cacheRaw = raw;
    cacheVal = value;
  }
  listeners.forEach((l) => l());
  setPanelOpen(false);
}

export function useConsent(version: string): ConsentState | null {
  const c = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
  return c && c.version === version ? c : null;
}

export function setPanelOpen(v: boolean) {
  panelOpen = v;
  panelListeners.forEach((l) => l());
}

export function usePanelOpen() {
  return useSyncExternalStore(
    (cb) => {
      panelListeners.add(cb);
      return () => panelListeners.delete(cb);
    },
    () => panelOpen,
    () => false,
  );
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
