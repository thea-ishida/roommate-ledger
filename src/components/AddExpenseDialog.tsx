"use client";

import { useMemo, useState } from "react";
import { todayISO } from "@/lib/dates";
import { computeShares } from "@/lib/ledger";
import { formatMoney, parseCents } from "@/lib/money";
import type { Member, NewExpense, SplitType } from "@/lib/types";
import { Dialog } from "./Dialog";

const METHODS: { type: SplitType; label: string; unit: string }[] = [
  { type: "equal", label: "Equally", unit: "" },
  { type: "exact", label: "Amounts", unit: "$" },
  { type: "percent", label: "Percent", unit: "%" },
  { type: "shares", label: "Shares", unit: "×" },
];

interface Props {
  members: Member[];
  me: string;
  currency: string;
  onClose: () => void;
  onSave: (e: NewExpense) => Promise<void>;
}

export function AddExpenseDialog({ members, me, currency, onClose, onSave }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(me);
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<SplitType>("equal");
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(members.map((m) => [m.id, true])));
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const amountCents = parseCents(amount);

  const values = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of members) {
      if (!included[m.id]) continue;
      if (type === "equal") out[m.id] = 1;
      else if (type === "exact") out[m.id] = parseCents(inputs[m.id] ?? "") || 0;
      else out[m.id] = parseFloat(inputs[m.id] ?? "") || 0;
    }
    return out;
  }, [members, included, inputs, type]);

  // Live preview of each person's share, or why the split doesn't work yet.
  const preview = useMemo(() => {
    if (!(amountCents > 0)) return { shares: null, error: "" };
    try {
      return { shares: computeShares(amountCents, { type, values }), error: "" };
    } catch (err) {
      return { shares: null, error: (err as Error).message };
    }
  }, [amountCents, type, values]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(amountCents > 0)) return setError("Enter an amount");
    if (preview.error) return setError(preview.error);
    setBusy(true);
    setError("");
    try {
      await onSave({ description, amountCents, paidBy, date, dueDate: dueDate || null, split: { type, values } });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog title="Add expense" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Description</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Hydro, groceries, internet…" required maxLength={80} autoFocus />
        </label>
        <div className="grid2">
          <label className="field">
            <span>Amount</span>
            <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
          </label>
          <label className="field">
            <span>Paid by</span>
            <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me ? `${m.name} (you)` : m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid2">
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            <span>Due date (optional)</span>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>

        <div className="field">
          <span>Split</span>
          <div className="seg" role="group" aria-label="Split method">
            {METHODS.map((m) => (
              <button type="button" key={m.type} aria-pressed={type === m.type} onClick={() => setType(m.type)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          {members.map((m) => (
            <div className="split-row" key={m.id}>
              <label>
                <input type="checkbox" checked={!!included[m.id]} onChange={(e) => setIncluded((x) => ({ ...x, [m.id]: e.target.checked }))} />
                <span className="title">{m.name}</span>
              </label>
              {type !== "equal" && included[m.id] && (
                <input
                  className="input num"
                  inputMode="decimal"
                  aria-label={`${m.name} ${type}`}
                  placeholder={METHODS.find((x) => x.type === type)!.unit}
                  value={inputs[m.id] ?? ""}
                  onChange={(e) => setInputs((x) => ({ ...x, [m.id]: e.target.value }))}
                />
              )}
              <span className="num muted small" style={{ width: 80, textAlign: "right" }}>
                {preview.shares?.[m.id] ? formatMoney(preview.shares[m.id], currency) : "—"}
              </span>
            </div>
          ))}
        </div>
        <p className={`hint ${preview.error ? "neg" : "muted"}`}>{preview.error}</p>

        {error && <p className="error">{error}</p>}
        <footer>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Add expense"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
