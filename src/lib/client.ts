import { useMemo, useSyncExternalStore } from "react";
import type { HouseholdState } from "./types";

/** Every mutation endpoint returns the fresh household state, so the UI just swaps it in. */
export async function api(path: string, init?: { method?: string; body?: unknown }): Promise<HouseholdState> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

export function rememberHousehold(id: string, name: string) {
  const list = recentHouseholds().filter((h) => h.id !== id);
  storage.set("rl:recent", JSON.stringify([{ id, name }, ...list].slice(0, 6)));
}

export function recentHouseholds(): { id: string; name: string }[] {
  return parseRecent(storage.get("rl:recent"));
}

function parseRecent(raw: string | null): { id: string; name: string }[] {
  try {
    return JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
}

/** Recently opened households on this device; empty during server render. */
export function useRecentHouseholds() {
  const raw = useSyncExternalStore(
    () => () => {},
    () => storage.get("rl:recent"),
    () => null,
  );
  return useMemo(() => parseRecent(raw), [raw]);
}

export function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
