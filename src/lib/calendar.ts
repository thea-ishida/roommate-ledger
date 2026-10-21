import { addDays, nextSettleDate, todayISO } from "./dates";
import { currentSettleUp } from "./ledger";
import { formatMoney } from "./money";
import type { HouseholdState } from "./types";

export interface Reminder {
  uid: string;
  /** All-day event date, YYYY-MM-DD. */
  date: string;
  title: string;
  details: string;
  url?: string;
}

const compact = (date: string) => date.replaceAll("-", "");

// RFC 5545 text escaping and 75-octet line folding.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = " " + rest.slice(73);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(reminders: Reminder[], calendarName = "Roommate Ledger"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Roommate Ledger//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calendarName)}`,
    // Hint to subscribing apps how often to re-fetch (Apple/Outlook honour it).
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const r of reminders) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(r.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(r.date, 1))}`,
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(r.details + (r.url ? `\n\n${r.url}` : ""))}`,
      ...(r.url ? [`URL:${r.url}`] : []),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(r.title)}`,
      "TRIGGER;RELATED=START:PT9H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(r: Reminder): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: r.title,
    dates: `${compact(r.date)}/${compact(addDays(r.date, 1))}`,
    details: r.details + (r.url ? `\n\n${r.url}` : ""),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function outlookCalendarUrl(r: Reminder): string {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: r.title,
    body: r.details + (r.url ? `\n\n${r.url}` : ""),
    startdt: r.date,
    enddt: addDays(r.date, 1),
    allday: "true",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
}

/** Google adds a subscription from a webcal URL passed as `cid`. */
export function googleSubscribeUrl(feedUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl.replace(/^https?:/, "webcal:"))}`;
}

/**
 * Everything a member still has to pay, as calendar events:
 * one per outstanding settle-up transfer (on the next settle day), plus one per
 * upcoming bill with a due date that they have a share in.
 */
export function remindersFor(state: HouseholdState, memberId: string, appUrl: string, today = todayISO()): Reminder[] {
  const name = (id: string) => state.members.find((m) => m.id === id)?.name ?? "a roommate";
  const money = (c: number) => formatMoney(c, state.household.currency);
  const settleOn = nextSettleDate(state.household.settleDay, today);
  const out: Reminder[] = [];

  for (const t of currentSettleUp(state)) {
    if (t.from !== memberId) continue;
    const to = state.members.find((m) => m.id === t.to);
    out.push({
      uid: `settle-${state.household.id}-${t.from}-${t.to}@roommate-ledger`,
      date: settleOn,
      title: `Pay ${name(t.to)} ${money(t.amountCents)}`,
      details: `Settle up for ${state.household.name}.` + (to?.etransfer ? `\ne-Transfer to: ${to.etransfer}` : ""),
      url: appUrl,
    });
  }

  for (const e of state.expenses) {
    const share = e.shares[memberId];
    if (!e.dueDate || !share || e.paidBy === memberId || e.dueDate < addDays(today, -7)) continue;
    out.push({
      uid: `bill-${e.id}-${memberId}@roommate-ledger`,
      date: e.dueDate,
      title: `${e.description} due · your share ${money(share)}`,
      details: `${name(e.paidBy)} paid ${money(e.amountCents)}. Your share is ${money(share)}.`,
      url: appUrl,
    });
  }
  return out;
}
