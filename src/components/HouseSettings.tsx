"use client";

import { useState } from "react";
import { googleSubscribeUrl } from "@/lib/calendar";
import { initials } from "@/lib/client";
import type { HouseholdState, Member } from "@/lib/types";
import { ordinal } from "./CreateHousehold";

interface Props {
  state: HouseholdState;
  me: string;
  mutate: (path: string, method: string, body?: unknown, done?: string) => Promise<void>;
  flash: (msg: string) => void;
}

const quiet = (p: Promise<unknown>) => p.catch(() => {});

export function HouseSettings({ state, me, mutate, flash }: Props) {
  const { household, members } = state;
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/h/${household.id}`;
  const mine = members.find((m) => m.id === me)!;
  const feedUrl = `${origin}/api/calendar/${mine.calendarToken}.ics`;

  const copy = (text: string, msg: string) => navigator.clipboard.writeText(text).then(() => flash(msg), () => flash(text));

  return (
    <>
      <section>
        <h2>Invite roommates</h2>
        <div className="copy">
          <div style={{ minWidth: 0 }}>
            <div className="k">Private link — anyone with it can view and add expenses</div>
            <div className="v small num">{shareUrl}</div>
          </div>
          <button className="btn sm" onClick={() => copy(shareUrl, "Link copied")}>
            Copy
          </button>
        </div>
      </section>

      <section>
        <h2>Your payment reminders</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Subscribe once and your calendar keeps itself up to date: what you owe shows up on the {ordinal(household.settleDay)} of each
          month, and bills with a due date show up on that day. It updates automatically as expenses change.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn" href={googleSubscribeUrl(feedUrl)} target="_blank" rel="noreferrer">
            Google Calendar ↗
          </a>
          <a className="btn" href={feedUrl.replace(/^https?:/, "webcal:")}>
            Apple Calendar
          </a>
          <button className="btn" onClick={() => copy(feedUrl, "Feed URL copied — paste it into Outlook › Add calendar › From internet")}>
            Copy feed URL
          </button>
        </div>
        <p className="muted small">Keep this link to yourself — it shows what you owe.</p>
      </section>

      <section>
        <h2>Roommates</h2>
        <ul className="list">
          {members.map((m) => (
            <MemberRow key={m.id} m={m} isMe={m.id === me} onSave={(patch, msg) => quiet(mutate(`/members/${m.id}`, "PATCH", patch, msg))} />
          ))}
        </ul>
        <form
          className="grid2"
          style={{ gridTemplateColumns: "1fr 1.3fr auto", marginTop: 12 }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            await quiet(mutate("/members", "POST", { name: newName, etransfer: newContact }, `${newName} added`));
            setNewName("");
            setNewContact("");
          }}
        >
          <input className="input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} aria-label="New roommate name" />
          <input className="input" placeholder="e-Transfer email (optional)" value={newContact} onChange={(e) => setNewContact(e.target.value)} aria-label="New roommate e-Transfer contact" />
          <button className="btn">Add</button>
        </form>
      </section>

      <section>
        <h2>Household</h2>
        <div className="grid2">
          <label className="field">
            <span>Name</span>
            <input
              className="input"
              defaultValue={household.name}
              maxLength={60}
              onBlur={(e) => e.target.value.trim() && e.target.value !== household.name && quiet(mutate("", "PATCH", { name: e.target.value }, "Saved"))}
            />
          </label>
          <label className="field">
            <span>Settle-up day</span>
            <select className="input" value={household.settleDay} onChange={(e) => quiet(mutate("", "PATCH", { settleDay: Number(e.target.value) }, "Saved"))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {ordinal(d)} of the month
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </>
  );
}

function MemberRow({ m, isMe, onSave }: { m: Member; isMe: boolean; onSave: (patch: Partial<Member>, msg: string) => void }) {
  const [contact, setContact] = useState(m.etransfer ?? "");
  return (
    <li className="row" style={m.active ? undefined : { opacity: 0.5 }}>
      <span className="avatar">{initials(m.name)}</span>
      <div className="main">
        <div className="title">
          {m.name}
          {isMe && <span className="muted"> (you)</span>}
          {!m.active && <span className="pill" style={{ marginLeft: 6 }}>Moved out</span>}
        </div>
        <input
          className="input small"
          style={{ padding: "4px 8px", marginTop: 4 }}
          placeholder="e-Transfer email or phone"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          onBlur={() => contact !== (m.etransfer ?? "") && onSave({ etransfer: contact || null }, "Saved")}
          aria-label={`${m.name} e-Transfer contact`}
        />
      </div>
      {!isMe && (
        <button className="btn ghost sm" onClick={() => onSave({ active: !m.active }, m.active ? `${m.name} marked as moved out` : `${m.name} is back`)}>
          {m.active ? "Mark moved out" : "Restore"}
        </button>
      )}
    </li>
  );
}
