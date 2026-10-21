import { describe, expect, it } from "vitest";
import { allocate, balances, computeShares, simplify, summarizeMonth } from "./ledger";
import type { Expense, HouseholdState } from "./types";

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe("allocate", () => {
  it("splits evenly and hands leftover cents to the first people", () => {
    expect(allocate(1000, [["a", 1], ["b", 1], ["c", 1]])).toEqual({ a: 334, b: 333, c: 333 });
  });
  it("always sums to the total", () => {
    for (const total of [1, 7, 99, 12345, 100001]) {
      expect(sum(allocate(total, [["a", 3], ["b", 1], ["c", 2.5]]))).toBe(total);
    }
  });
});

describe("computeShares", () => {
  it("equal split only includes ticked members", () => {
    expect(computeShares(900, { type: "equal", values: { a: 1, b: 0, c: 1 } })).toEqual({ a: 450, c: 450 });
  });
  it("percent split must total 100", () => {
    expect(computeShares(10000, { type: "percent", values: { a: 60, b: 40 } })).toEqual({ a: 6000, b: 4000 });
    expect(() => computeShares(10000, { type: "percent", values: { a: 60, b: 30 } })).toThrow(/90%/);
  });
  it("exact split must match the amount", () => {
    expect(computeShares(500, { type: "exact", values: { a: 200, b: 300 } })).toEqual({ a: 200, b: 300 });
    expect(() => computeShares(500, { type: "exact", values: { a: 200, b: 200 } })).toThrow(/short by \$1.00/);
  });
  it("shares split weights by share count", () => {
    expect(computeShares(1000, { type: "shares", values: { a: 2, b: 1, c: 1 } })).toEqual({ a: 500, b: 250, c: 250 });
  });
  it("rejects a split with nobody in it", () => {
    expect(() => computeShares(1000, { type: "equal", values: {} })).toThrow();
  });
});

const exp = (over: Partial<Expense>): Expense => ({
  id: Math.random().toString(36),
  description: "x",
  amountCents: 0,
  paidBy: "a",
  date: "2026-10-05",
  dueDate: null,
  split: { type: "equal", values: {} },
  shares: {},
  createdAt: "2026-10-05T00:00:00Z",
  ...over,
});

describe("balances and simplify", () => {
  it("nets expenses and settlements", () => {
    const e = [exp({ amountCents: 3000, paidBy: "a", shares: { a: 1000, b: 1000, c: 1000 } })];
    const net = balances(["a", "b", "c"], e, [
      { id: "s", from: "b", to: "a", amountCents: 1000, date: "2026-10-06", method: "etransfer", status: "sent", createdAt: "" },
    ]);
    expect(net).toEqual({ a: 1000, b: 0, c: -1000 });
    expect(simplify(net)).toEqual([{ from: "c", to: "a", amountCents: 1000 }]);
  });
  it("needs at most n-1 transfers", () => {
    const t = simplify({ a: 500, b: -200, c: -200, d: -100 });
    expect(t.length).toBeLessThanOrEqual(3);
    expect(t.reduce((s, x) => s + x.amountCents, 0)).toBe(500);
  });
});

describe("summarizeMonth", () => {
  it("carries earlier balances into the running total", () => {
    const state: HouseholdState = {
      household: { id: "h", name: "H", currency: "CAD", settleDay: 1, createdAt: "" },
      members: ["a", "b"].map((id) => ({ id, name: id, etransfer: null, calendarToken: id, active: true })),
      expenses: [
        exp({ amountCents: 2000, paidBy: "a", date: "2026-09-10", shares: { a: 1000, b: 1000 } }),
        exp({ amountCents: 600, paidBy: "b", date: "2026-10-02", shares: { a: 300, b: 300 } }),
        exp({ amountCents: 999, paidBy: "b", date: "2026-11-02", shares: { a: 500, b: 499 } }),
      ],
      settlements: [],
    };
    const oct = summarizeMonth(state, "2026-10");
    expect(oct.totalCents).toBe(600);
    expect(oct.carried).toEqual({ a: 1000, b: -1000 });
    expect(oct.balance).toEqual({ a: 700, b: -700 });
    expect(oct.settleUp).toEqual([{ from: "b", to: "a", amountCents: 700 }]);
  });
});
