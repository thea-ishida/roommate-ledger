"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, rememberHousehold, storage, useRecentHouseholds } from "@/lib/client";

type Draft = { name: string; etransfer: string };

export function CreateHousehold() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [settleDay, setSettleDay] = useState(1);
  const [members, setMembers] = useState<Draft[]>([
    { name: "", etransfer: "" },
    { name: "", etransfer: "" },
  ]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const recent = useRecentHouseholds();

  const update = (i: number, patch: Partial<Draft>) =>
    setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const filled = members.filter((m) => m.name.trim());
    if (filled.length < 2) return setError("Add at least two roommates.");
    setBusy(true);
    try {
      const state = await api("/api/households", { method: "POST", body: { name, settleDay, members: filled } });
      rememberHousehold(state.household.id, state.household.name);
      // The creator is the first roommate listed.
      storage.set(`rl:me:${state.household.id}`, state.members[0].id);
      router.push(`/h/${state.household.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      {recent.length > 0 && (
        <section>
          <h2>Your households</h2>
          <ul className="list">
            {recent.map((h) => (
              <li key={h.id} className="row">
                <Link href={`/h/${h.id}`} className="main title" style={{ textDecoration: "none" }}>
                  {h.name}
                </Link>
                <span className="muted">→</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Start a household</h2>
        <form className="card" onSubmit={submit}>
          <label className="field">
            <span>Household name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 42 Harbord St" required maxLength={60} />
          </label>

          <div className="field">
            <span>Roommates — you first. e-Transfer email or phone is optional; it&apos;s shown when someone pays them.</span>
            {members.map((m, i) => (
              <div key={i} className="grid2" style={{ gridTemplateColumns: "1fr 1.3fr auto" }}>
                <input className="input" value={m.name} onChange={(e) => update(i, { name: e.target.value })} placeholder={i === 0 ? "Your name" : "Name"} maxLength={40} aria-label={`Roommate ${i + 1} name`} />
                <input className="input" value={m.etransfer} onChange={(e) => update(i, { etransfer: e.target.value })} placeholder="e-Transfer email" aria-label={`Roommate ${i + 1} e-Transfer contact`} />
                <button type="button" className="btn ghost icon" aria-label="Remove roommate" disabled={members.length <= 2} onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
            {members.length < 12 && (
              <button type="button" className="btn ghost sm" style={{ justifySelf: "start" }} onClick={() => setMembers((ms) => [...ms, { name: "", etransfer: "" }])}>
                + Add roommate
              </button>
            )}
          </div>

          <label className="field">
            <span>Settle-up day each month (used for calendar reminders)</span>
            <select className="input" value={settleDay} onChange={(e) => setSettleDay(Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {ordinal(d)} of the month
                </option>
              ))}
            </select>
          </label>

          <button className="btn primary block" disabled={busy}>
            {busy ? "Creating…" : "Create household"}
          </button>
          {error && <p className="error">{error}</p>}
          <p className="muted small" style={{ marginBottom: 0 }}>
            You&apos;ll get a private link to share with your roommates. Anyone with the link can view and add expenses.
          </p>
        </form>
      </section>
    </>
  );
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
