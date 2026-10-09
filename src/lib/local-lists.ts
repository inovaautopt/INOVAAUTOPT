"use client";
import { useSyncExternalStore } from "react";

/**
 * Favoritos e comparador guardados no navegador do visitante (localStorage).
 * Guardam APENAS identificadores de viaturas (sem dados pessoais) e não exigem registo.
 * Classificação: armazenamento estritamente necessário para uma funcionalidade pedida pelo
 * visitante — não é usado para seguimento nem enviado ao servidor a não ser para mostrar
 * o estado atual das viaturas escolhidas. Ver docs/SECURITY.md.
 */
export type ListName = "favorites" | "compare";
const KEYS: Record<ListName, string> = { favorites: "inova.favoritos.v1", compare: "inova.comparar.v1" };
export const COMPARE_MAX = 4;
const FAVORITES_MAX = 50;

const listeners = new Set<() => void>();
const cache: Partial<Record<ListName, { raw: string | null; value: string[] }>> = {};
const EMPTY: string[] = [];

function read(name: ListName): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEYS[name]);
  } catch {
    raw = null;
  }
  const c = cache[name];
  if (c && c.raw === raw) return c.value;
  let value: string[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    value = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : [];
  } catch {
    value = [];
  }
  cache[name] = { raw, value };
  return value;
}

function write(name: ListName, ids: string[]) {
  try {
    window.localStorage.setItem(KEYS[name], JSON.stringify(ids));
  } catch {
    /* armazenamento indisponível (modo privado): a funcionalidade continua só nesta página */
    cache[name] = { raw: JSON.stringify(ids), value: ids };
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.favorites || e.key === KEYS.compare) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useList(name: ListName): string[] {
  return useSyncExternalStore(
    subscribe,
    () => read(name),
    () => EMPTY,
  );
}

/** Devolve false se a lista estiver cheia. */
export function toggleInList(name: ListName, id: string): { added: boolean; full: boolean } {
  const current = read(name);
  if (current.includes(id)) {
    write(name, current.filter((x) => x !== id));
    return { added: false, full: false };
  }
  const max = name === "compare" ? COMPARE_MAX : FAVORITES_MAX;
  if (current.length >= max) return { added: false, full: true };
  write(name, [...current, id]);
  return { added: true, full: false };
}

export function removeFromList(name: ListName, id: string) {
  write(name, read(name).filter((x) => x !== id));
}

export function clearList(name: ListName) {
  write(name, []);
}
