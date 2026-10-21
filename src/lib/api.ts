import "server-only";
import { isISODate } from "./dates";
import { computeShares } from "./ledger";
import { NotFound, getStore } from "./store";
import type { HouseholdState, NewExpense, NewSettlement, SplitSpec, SplitType } from "./types";

export class BadRequest extends Error {}

/** Wraps a route handler so thrown errors become JSON responses with the right status. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof BadRequest) return Response.json({ error: err.message }, { status: 400 });
      if (err instanceof NotFound) return Response.json({ error: "Not found" }, { status: 404 });
      console.error(err);
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b;
  } catch {}
  throw new BadRequest("Expected a JSON object");
}

export async function loadHousehold(id: string): Promise<HouseholdState> {
  const state = await getStore().getHousehold(id);
  if (!state) throw new NotFound();
  return state;
}

export function text(v: unknown, field: string, max = 80): string {
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${field} is required`);
  if (v.length > max) throw new BadRequest(`${field} is too long`);
  return v.trim();
}

export function optionalText(v: unknown, field: string, max = 120): string | null {
  if (v == null || v === "") return null;
  return text(v, field, max);
}

export function cents(v: unknown, field = "Amount"): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0 || v > 100_000_000) {
    throw new BadRequest(`${field} must be a positive amount`);
  }
  return v;
}

export function settleDay(v: unknown): number {
  const n = Number(v ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 28) throw new BadRequest("Settle day must be between 1 and 28");
  return n;
}

function date(v: unknown, field: string): string {
  if (!isISODate(v)) throw new BadRequest(`${field} must be a YYYY-MM-DD date`);
  return v;
}

function member(state: HouseholdState, id: unknown, field: string): string {
  if (typeof id !== "string" || !state.members.some((m) => m.id === id)) throw new BadRequest(`${field} is not in this household`);
  return id;
}

const SPLIT_TYPES: SplitType[] = ["equal", "exact", "percent", "shares"];

export function parseExpense(state: HouseholdState, b: Record<string, unknown>): NewExpense & { shares: Record<string, number> } {
  const split = b.split as Partial<SplitSpec> | undefined;
  if (!split || !SPLIT_TYPES.includes(split.type as SplitType) || typeof split.values !== "object" || !split.values) {
    throw new BadRequest("Choose how to split the expense");
  }
  const values: Record<string, number> = {};
  for (const [id, v] of Object.entries(split.values)) {
    member(state, id, "Split member");
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new BadRequest("Split values must be positive numbers");
    if (v > 0) values[id] = v;
  }
  const spec: SplitSpec = { type: split.type as SplitType, values };
  const expense: NewExpense = {
    description: text(b.description, "Description"),
    amountCents: cents(b.amountCents),
    paidBy: member(state, b.paidBy, "Payer"),
    date: date(b.date, "Date"),
    dueDate: b.dueDate ? date(b.dueDate, "Due date") : null,
    split: spec,
  };
  try {
    return { ...expense, shares: computeShares(expense.amountCents, spec) };
  } catch (err) {
    throw new BadRequest((err as Error).message);
  }
}

export function parseSettlement(state: HouseholdState, b: Record<string, unknown>): NewSettlement {
  const from = member(state, b.from, "Payer");
  const to = member(state, b.to, "Recipient");
  if (from === to) throw new BadRequest("Can't pay yourself");
  const method = b.method ?? "etransfer";
  if (method !== "etransfer" && method !== "cash" && method !== "other") throw new BadRequest("Unknown payment method");
  return { from, to, amountCents: cents(b.amountCents), date: date(b.date, "Date"), method };
}
