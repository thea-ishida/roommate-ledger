import { lastDayOfMonth, monthKey } from "./dates";
import type { Expense, HouseholdState, Settlement, SplitSpec } from "./types";

/**
 * Splits `total` cents across weights using the largest-remainder method,
 * so the parts are whole cents and always sum to `total`. Ties go to the
 * earlier key, which keeps results stable between renders.
 */
export function allocate(total: number, weights: [string, number][]): Record<string, number> {
  const sum = weights.reduce((s, [, w]) => s + w, 0);
  if (sum <= 0) throw new Error("Split must include at least one person");
  const raw = weights.map(([id, w], i) => ({ id, i, exact: (total * w) / sum }));
  const out: Record<string, number> = {};
  let assigned = 0;
  for (const r of raw) {
    out[r.id] = Math.floor(r.exact);
    assigned += out[r.id];
  }
  const byRemainder = [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || a.i - b.i);
  for (let k = 0; k < total - assigned; k++) out[byRemainder[k % byRemainder.length].id] += 1;
  return out;
}

/** Turns a split spec into exact per-member cents. Throws a readable error if the inputs don't add up. */
export function computeShares(amountCents: number, split: SplitSpec): Record<string, number> {
  const entries = Object.entries(split.values).filter(([, v]) => Number.isFinite(v) && v > 0);
  if (!entries.length) throw new Error("Pick at least one person to split with");

  switch (split.type) {
    case "equal":
      return allocate(amountCents, entries.map(([id]) => [id, 1]));
    case "shares":
      return allocate(amountCents, entries);
    case "percent": {
      const pct = entries.reduce((s, [, v]) => s + v, 0);
      if (Math.abs(pct - 100) > 0.001) throw new Error(`Percentages add up to ${round2(pct)}%, not 100%`);
      return allocate(amountCents, entries);
    }
    case "exact": {
      const sum = entries.reduce((s, [, v]) => s + v, 0);
      if (sum !== amountCents) {
        const diff = amountCents - sum;
        throw new Error(`Amounts are ${diff > 0 ? "short" : "over"} by $${(Math.abs(diff) / 100).toFixed(2)}`);
      }
      return Object.fromEntries(entries.map(([id, v]) => [id, Math.round(v)]));
    }
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net balance per member: positive means the household owes them, negative means they owe. */
export function balances(
  memberIds: string[],
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, number> {
  const net: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const bump = (id: string, by: number) => (net[id] = (net[id] ?? 0) + by);
  for (const e of expenses) {
    bump(e.paidBy, e.amountCents);
    for (const [id, cents] of Object.entries(e.shares)) bump(id, -cents);
  }
  for (const s of settlements) {
    bump(s.from, s.amountCents);
    bump(s.to, -s.amountCents);
  }
  return net;
}

export interface Transfer {
  from: string;
  to: string;
  amountCents: number;
}

/** Fewest-transfers settle-up: repeatedly match the largest debtor with the largest creditor. */
export function simplify(net: Record<string, number>): Transfer[] {
  const debtors = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const out: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.v - a.v);
    creditors.sort((a, b) => b.v - a.v);
    const d = debtors[0];
    const c = creditors[0];
    const amt = Math.min(d.v, c.v);
    out.push({ from: d.id, to: c.id, amountCents: amt });
    d.v -= amt;
    c.v -= amt;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return out;
}

export interface MonthSummary {
  month: string;
  expenses: Expense[];
  settlements: Settlement[];
  totalCents: number;
  paid: Record<string, number>;
  share: Record<string, number>;
  /** Running balance at the end of the month, including everything before it. */
  balance: Record<string, number>;
  /** Balance carried in from earlier months. */
  carried: Record<string, number>;
  settleUp: Transfer[];
}

export function summarizeMonth(state: HouseholdState, month: string): MonthSummary {
  const ids = state.members.map((m) => m.id);
  const end = lastDayOfMonth(month);
  const start = `${month}-01`;

  const expenses = state.expenses.filter((e) => monthKey(e.date) === month).sort(byDateDesc);
  const settlements = state.settlements.filter((s) => monthKey(s.date) === month).sort(byDateDesc);

  const paid: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const share: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const e of expenses) {
    paid[e.paidBy] = (paid[e.paidBy] ?? 0) + e.amountCents;
    for (const [id, c] of Object.entries(e.shares)) share[id] = (share[id] ?? 0) + c;
  }

  const carried = balances(
    ids,
    state.expenses.filter((e) => e.date < start),
    state.settlements.filter((s) => s.date < start),
  );
  const balance = balances(
    ids,
    state.expenses.filter((e) => e.date <= end),
    state.settlements.filter((s) => s.date <= end),
  );

  return {
    month,
    expenses,
    settlements,
    totalCents: expenses.reduce((s, e) => s + e.amountCents, 0),
    paid,
    share,
    balance,
    carried,
    settleUp: simplify(balance),
  };
}

function byDateDesc<T extends { date: string; createdAt: string }>(a: T, b: T) {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

/** Current outstanding transfers across all time. */
export function currentSettleUp(state: HouseholdState): Transfer[] {
  return simplify(balances(state.members.map((m) => m.id), state.expenses, state.settlements));
}
