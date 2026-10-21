const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency = "CAD"): string {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-CA", { style: "currency", currency });
    formatters.set(currency, f);
  }
  return f.format(cents / 100);
}

/** Parses "12.5", "$1,200.00" etc. into cents. Returns NaN on bad input. */
export function parseCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === ".") return NaN;
  return Math.round(parseFloat(cleaned) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
