import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, remindersFor } from "./calendar";
import type { HouseholdState } from "./types";

const state: HouseholdState = {
  household: { id: "h1", name: "Harbord, St", currency: "CAD", settleDay: 1, createdAt: "" },
  members: [
    { id: "a", name: "Thea", etransfer: "thea@example.com", calendarToken: "ta", active: true },
    { id: "b", name: "Sydney", etransfer: null, calendarToken: "tb", active: true },
  ],
  expenses: [
    {
      id: "e1",
      description: "Hydro",
      amountCents: 12000,
      paidBy: "a",
      date: "2026-10-03",
      dueDate: "2026-10-25",
      split: { type: "equal", values: { a: 1, b: 1 } },
      shares: { a: 6000, b: 6000 },
      createdAt: "",
    },
  ],
  settlements: [],
};

describe("remindersFor", () => {
  it("gives the debtor a settle-up and a bill reminder", () => {
    const r = remindersFor(state, "b", "https://x.test/h/h1", "2026-10-21");
    expect(r.map((x) => x.title)).toEqual(["Pay Thea $60.00", "Hydro due · your share $60.00"]);
    expect(r[0].date).toBe("2026-11-01");
    expect(r[0].details).toContain("thea@example.com");
  });
  it("gives the creditor nothing to pay", () => {
    expect(remindersFor(state, "a", "", "2026-10-21")).toEqual([]);
  });
});

describe("buildIcs", () => {
  it("produces escaped all-day events with CRLF line endings", () => {
    const ics = buildIcs(remindersFor(state, "b", "", "2026-10-21"), "Harbord, St");
    expect(ics).toContain("X-WR-CALNAME:Harbord\\, St");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261101");
    expect(ics).toContain("DTEND;VALUE=DATE:20261102");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});

it("builds a Google Calendar template link", () => {
  const url = new URL(googleCalendarUrl({ uid: "u", date: "2026-12-31", title: "Pay", details: "d" }));
  expect(url.searchParams.get("dates")).toBe("20261231/20270101");
});
