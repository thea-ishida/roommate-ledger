"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { nextSettleDate, formatDate, monthKey, monthLabel, shiftMonth, todayISO } from "@/lib/dates";
import { api, initials, rememberHousehold, storage } from "@/lib/client";
import { summarizeMonth, type Transfer } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import type { Expense, HouseholdState, NewExpense } from "@/lib/types";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { HouseSettings } from "./HouseSettings";
import { PayDialog } from "./PayDialog";
import { ReminderMenu } from "./ReminderMenu";

type Tab = "summary" | "activity" | "house";

const quiet = (p: Promise<unknown>) => p.catch(() => {});

export function HouseholdApp({ id }: { id: string }) {
  const [state, setState] = useState<HouseholdState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<Transfer | null>(null);
  const [toast, setToast] = useState("");

  const base = `/api/households/${id}`;

  useEffect(() => {
    api(base)
      .then((s) => {
        setState(s);
        rememberHousehold(s.household.id, s.household.name);
        const saved = storage.get(`rl:me:${id}`);
        if (saved && s.members.some((m) => m.id === saved)) setMe(saved);
      })
      .catch((err) => setLoadError(err.message));
  }, [base, id]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  /** Run a mutation, swap in the fresh state it returns, and report errors. */
  const mutate = useCallback(
    async (path: string, method: string, body?: unknown, done?: string) => {
      try {
        setState(await api(base + path, { method, body }));
        if (done) flash(done);
      } catch (err) {
        flash((err as Error).message);
        throw err;
      }
    },
    [base, flash],
  );

  const summary = useMemo(() => state && summarizeMonth(state, month), [state, month]);

  if (loadError) {
    return (
      <main className="page center">
        <div>
          <h1>Household not found</h1>
          <p className="muted">Check the link, or start a new one.</p>
          <Link className="btn" href="/">
            Go home
          </Link>
        </div>
      </main>
    );
  }
  if (!state || !summary) return <main className="page muted">Loading…</main>;

  const { household, members } = state;
  const name = (mid: string) => members.find((m) => m.id === mid)?.name ?? "Former roommate";
  const money = (c: number) => formatMoney(c, household.currency);
  const active = members.filter((m) => m.active);
  const isCurrentOrFuture = month >= monthKey(todayISO());
  const appUrl = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";

  if (!me) {
    return (
      <main className="page">
        <Header name={household.name} />
        <h1>Who are you?</h1>
        <p className="muted">This is remembered on this device so balances read from your side.</p>
        <ul className="list">
          {active.map((m) => (
            <li key={m.id} className="row">
              <span className="avatar">{initials(m.name)}</span>
              <span className="main">{m.name}</span>
              <button
                className="btn sm"
                onClick={() => {
                  storage.set(`rl:me:${id}`, m.id);
                  setMe(m.id);
                }}
              >
                That&apos;s me
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const myBalance = summary.balance[me] ?? 0;
  const maxAbs = Math.max(1, ...Object.values(summary.balance).map(Math.abs));

  return (
    <main className="page">
      <Header name={household.name}>
        <select
          className="input"
          style={{ width: "auto", padding: "5px 8px", fontSize: 14 }}
          value={me}
          aria-label="You are"
          onChange={(e) => {
            storage.set(`rl:me:${id}`, e.target.value);
            setMe(e.target.value);
          }}
        >
          {active.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Header>

      <div className="tabs" role="tablist">
        {(["summary", "activity", "house"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === "summary" ? "Summary" : t === "activity" ? "Activity" : "House"}
          </button>
        ))}
      </div>

      {tab !== "house" && (
        <div className="month">
          <strong>{monthLabel(month)}</strong>
          <span className="spacer" />
          <button className="btn ghost icon" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            ‹
          </button>
          {month !== monthKey(todayISO()) ? (
            <button className="btn ghost sm" onClick={() => setMonth(monthKey(todayISO()))}>
              Today
            </button>
          ) : null}
          <button className="btn ghost icon" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            ›
          </button>
        </div>
      )}

      {tab === "summary" && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="label">Spent this month</div>
              <div className="value num">{money(summary.totalCents)}</div>
            </div>
            <div className="stat">
              <div className="label">Your share</div>
              <div className="value num">{money(summary.share[me] ?? 0)}</div>
            </div>
            <div className="stat">
              <div className="label">{myBalance > 0 ? "You're owed" : myBalance < 0 ? "You owe" : "All square"}</div>
              <div className={`value num ${myBalance > 0 ? "pos" : myBalance < 0 ? "neg" : ""}`}>{money(Math.abs(myBalance))}</div>
            </div>
          </div>

          <section>
            <h2>Settle up</h2>
            <ul className="list">
              {summary.settleUp.length === 0 && <li className="empty">Everyone&apos;s even. Nice.</li>}
              {summary.settleUp.map((t) => {
                const mine = t.from === me;
                const reminder = {
                  uid: `settle-${household.id}-${t.from}-${t.to}@roommate-ledger`,
                  date: nextSettleDate(household.settleDay, todayISO()),
                  title: `Pay ${name(t.to)} ${money(t.amountCents)}`,
                  details: `Settle up for ${household.name}.`,
                  url: appUrl,
                };
                return (
                  <li key={`${t.from}-${t.to}`} className="row">
                    <div className="main">
                      <div className="title">
                        {mine ? "You" : name(t.from)} <span className="muted">→</span> {t.to === me ? "you" : name(t.to)}
                      </div>
                      {mine && <div className="sub">Due {formatDate(reminder.date)}</div>}
                    </div>
                    <span className={`amt num ${mine ? "neg" : t.to === me ? "pos" : ""}`}>{money(t.amountCents)}</span>
                    {mine && isCurrentOrFuture && (
                      <span className="actions">
                        <ReminderMenu reminder={reminder} label="Remind" />
                        <button className="btn sm primary" onClick={() => setPaying(t)}>
                          Pay
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2>Running balances</h2>
            <ul className="list">
              {members
                .filter((m) => m.active || summary.balance[m.id])
                .map((m) => {
                  const b = summary.balance[m.id] ?? 0;
                  const carried = summary.carried[m.id] ?? 0;
                  const w = (Math.abs(b) / maxAbs) * 50;
                  return (
                    <li key={m.id} className="row">
                      <span className="avatar">{initials(m.name)}</span>
                      <div className="main">
                        <div className="title">
                          {m.name}
                          {m.id === me && <span className="muted"> (you)</span>}
                        </div>
                        <div className="sub">
                          Paid {money(summary.paid[m.id] ?? 0)} · share {money(summary.share[m.id] ?? 0)}
                          {carried !== 0 && ` · carried ${carried > 0 ? "+" : "−"}${money(Math.abs(carried))}`}
                        </div>
                        <div className="bar">
                          <i style={b >= 0 ? { left: "50%", width: `${w}%`, background: "var(--pos)" } : { right: "50%", width: `${w}%`, background: "var(--neg)" }} />
                        </div>
                      </div>
                      <span className={`amt num ${b > 0 ? "pos" : b < 0 ? "neg" : "muted"}`}>
                        {b > 0 ? "+" : b < 0 ? "−" : ""}
                        {money(Math.abs(b))}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>
        </>
      )}

      {tab === "activity" && (
        <>
          <section style={{ marginTop: 16 }}>
            <h2>Expenses</h2>
            <ul className="list">
              {summary.expenses.length === 0 && <li className="empty">No expenses this month.</li>}
              {summary.expenses.map((e) => (
                <ExpenseRow key={e.id} e={e} me={me} name={name} money={money} appUrl={appUrl} onDelete={() => quiet(mutate(`/expenses/${e.id}`, "DELETE", undefined, "Expense deleted"))} />
              ))}
            </ul>
          </section>
          <section>
            <h2>Payments</h2>
            <ul className="list">
              {summary.settlements.length === 0 && <li className="empty">No payments this month.</li>}
              {summary.settlements.map((s) => (
                <li key={s.id} className="row">
                  <div className="main">
                    <div className="title">
                      {s.from === me ? "You" : name(s.from)} paid {s.to === me ? "you" : name(s.to)}{" "}
                      <span className={`pill ${s.status === "received" ? "ok" : ""}`}>{s.status === "received" ? "Received" : "Sent"}</span>
                    </div>
                    <div className="sub">
                      {formatDate(s.date)} · {s.method === "etransfer" ? "e-Transfer" : s.method}
                    </div>
                  </div>
                  <span className="amt num">{money(s.amountCents)}</span>
                  <span className="actions">
                    {s.to === me && s.status === "sent" && (
                      <button className="btn sm" onClick={() => quiet(mutate(`/settlements/${s.id}`, "PATCH", { status: "received" }, "Marked as received"))}>
                        Confirm
                      </button>
                    )}
                    {(s.from === me || s.to === me) && (
                      <button
                        className="btn ghost sm"
                        aria-label="Delete payment"
                        onClick={() => confirm("Delete this payment?") && quiet(mutate(`/settlements/${s.id}`, "DELETE", undefined, "Payment deleted"))}
                      >
                        ×
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === "house" && <HouseSettings state={state} me={me} mutate={mutate} flash={flash} />}

      {tab !== "house" && (
        <button className="btn primary fab" onClick={() => setAdding(true)}>
          + Add expense
        </button>
      )}

      {adding && (
        <AddExpenseDialog
          members={active}
          me={me}
          currency={household.currency}
          onClose={() => setAdding(false)}
          onSave={async (e: NewExpense) => {
            await mutate("/expenses", "POST", e, "Expense added");
            setAdding(false);
            setMonth(monthKey(e.date));
          }}
        />
      )}

      {paying && (
        <PayDialog
          householdName={household.name}
          currency={household.currency}
          to={members.find((m) => m.id === paying.to)!}
          amountCents={paying.amountCents}
          onClose={() => setPaying(null)}
          onSent={async () => {
            await mutate("/settlements", "POST", { from: paying.from, to: paying.to, amountCents: paying.amountCents, date: todayISO(), method: "etransfer" }, "Payment recorded");
            setPaying(null);
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function Header({ name, children }: { name: string; children?: React.ReactNode }) {
  return (
    <div className="top">
      <Link href="/" className="brand">
        Roommate Ledger <span>/ {name}</span>
      </Link>
      {children}
    </div>
  );
}

function ExpenseRow(props: {
  e: Expense;
  me: string;
  name: (id: string) => string;
  money: (c: number) => string;
  appUrl: string;
  onDelete: () => void;
}) {
  const { e, me, name, money, appUrl, onDelete } = props;
  const [open, setOpen] = useState(false);
  const myShare = e.shares[me] ?? 0;
  // What this expense did to my balance: positive if others owe me for it.
  const effect = (e.paidBy === me ? e.amountCents : 0) - myShare;

  return (
    <li style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="row" style={{ borderBottom: 0, cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div className="main">
          <div className="title">{e.description}</div>
          <div className="sub">
            {e.paidBy === me ? "You" : name(e.paidBy)} paid · {formatDate(e.date)}
            {e.dueDate && ` · due ${formatDate(e.dueDate)}`}
          </div>
        </div>
        <div className="amt">
          <div className="num">{money(e.amountCents)}</div>
          <div className={`small num ${effect > 0 ? "pos" : effect < 0 ? "neg" : "muted"}`}>
            {effect > 0 ? `you lent ${money(effect)}` : effect < 0 ? `you owe ${money(-effect)}` : "not involved"}
          </div>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 0 14px" }}>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Split {e.split.type === "equal" ? "equally" : `by ${e.split.type === "exact" ? "amount" : e.split.type}`}
          </div>
          {Object.entries(e.shares).map(([mid, c]) => (
            <div key={mid} className="small" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{mid === me ? "You" : name(mid)}</span>
              <span className="num">{money(c)}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            {e.dueDate && myShare > 0 && e.paidBy !== me && (
              <ReminderMenu
                reminder={{
                  uid: `bill-${e.id}-${me}@roommate-ledger`,
                  date: e.dueDate,
                  title: `${e.description} due · your share ${money(myShare)}`,
                  details: `${name(e.paidBy)} paid ${money(e.amountCents)}. Your share is ${money(myShare)}.`,
                  url: appUrl,
                }}
              />
            )}
            <button className="btn sm" onClick={() => confirm(`Delete “${e.description}”?`) && onDelete()}>
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
