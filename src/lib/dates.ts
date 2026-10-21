/** Local-calendar date helpers. All dates are plain YYYY-MM-DD strings. */

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-CA", { month: "long", year: "numeric" });
}

export function lastDayOfMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${key}-${String(d).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

/** Next date on or after `from` that falls on `day` of the month. */
export function nextSettleDate(day: number, from: string): string {
  const key = monthKey(from);
  const candidate = `${key}-${String(day).padStart(2, "0")}`;
  return candidate >= from ? candidate : `${shiftMonth(key, 1)}-${String(day).padStart(2, "0")}`;
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
