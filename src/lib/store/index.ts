import "server-only";
import os from "node:os";
import path from "node:path";
import { createJsonStore } from "./json-store";
import { createPostgresStore } from "./postgres-store";
import type { Store } from "./types";

export { NotFound } from "./json-store";
export type { Store } from "./types";

let store: Store | null = null;

/**
 * Picks storage from the environment, lazily so `next build` never needs a
 * database. DATABASE_URL (set by the Neon integration on Vercel) wins;
 * otherwise a local JSON file is used.
 */
export function getStore(): Store {
  if (store) return store;
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (url) {
    store = createPostgresStore(url);
  } else {
    const file =
      process.env.LEDGER_DATA_FILE ??
      (process.env.VERCEL ? path.join(os.tmpdir(), "ledger.json") : path.join(process.cwd(), ".data", "ledger.json"));
    if (process.env.VERCEL) console.warn("DATABASE_URL is not set; data will not survive between deployments.");
    store = createJsonStore(file);
  }
  return store;
}
