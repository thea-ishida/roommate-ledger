"use client";

import { useState } from "react";
import { BANKS } from "@/lib/banks";
import { storage } from "@/lib/client";
import { monthLabel, todayISO } from "@/lib/dates";
import { centsToInput, formatMoney } from "@/lib/money";
import type { Member } from "@/lib/types";
import { Dialog } from "./Dialog";

interface Props {
  householdName: string;
  currency: string;
  to: Member;
  amountCents: number;
  onClose: () => void;
  onSent: () => Promise<void>;
}

/**
 * Interac has no web API for consumers, so this is a guided hand-off: copy the
 * details, sign in to your own bank in a new tab, then come back and mark it sent.
 */
export function PayDialog({ householdName, currency, to, amountCents, onClose, onSent }: Props) {
  const [bank, setBank] = useState(() => storage.get("rl:bank") ?? "");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const memo = `${householdName} – ${monthLabel(todayISO().slice(0, 7))}`;
  const chosen = BANKS.find((b) => b.id === bank);

  async function copy(key: string, value: string) {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <Dialog title={`Pay ${to.name}`} onClose={onClose}>
      <p className="num" style={{ fontSize: 32, margin: "0 0 14px", letterSpacing: "-0.03em" }}>
        {formatMoney(amountCents, currency)}
      </p>

      <ol className="steps">
        <li>Choose your bank and sign in (opens a new tab).</li>
        <li>Go to Interac e-Transfer → Send money, and paste the details below.</li>
        <li>Come back here and tap &ldquo;I&apos;ve sent it&rdquo;.</li>
      </ol>

      <CopyRow label="Send to" value={to.etransfer ?? `Ask ${to.name} for their e-Transfer email`} disabled={!to.etransfer} copied={copied === "to"} onCopy={() => to.etransfer && copy("to", to.etransfer)} />
      <CopyRow label="Amount" value={centsToInput(amountCents)} copied={copied === "amt"} onCopy={() => copy("amt", centsToInput(amountCents))} />
      <CopyRow label="Message" value={memo} copied={copied === "memo"} onCopy={() => copy("memo", memo)} />

      <div className="grid2" style={{ gridTemplateColumns: "1fr auto", marginTop: 14 }}>
        <select
          className="input"
          value={bank}
          onChange={(e) => {
            setBank(e.target.value);
            storage.set("rl:bank", e.target.value);
          }}
          aria-label="Your bank"
        >
          <option value="">Choose your bank…</option>
          {BANKS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <a
          className="btn primary"
          href={chosen?.loginUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-disabled={!chosen}
          style={chosen ? undefined : { pointerEvents: "none", opacity: 0.45 }}
        >
          Sign in to bank ↗
        </a>
      </div>
      <p className="muted small">We never see your banking details — you sign in directly on your bank&apos;s site.</p>

      <footer>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSent().finally(() => setBusy(false));
          }}
        >
          I&apos;ve sent it
        </button>
      </footer>
    </Dialog>
  );
}

function CopyRow({ label, value, copied, onCopy, disabled }: { label: string; value: string; copied: boolean; onCopy: () => void; disabled?: boolean }) {
  return (
    <div className="copy">
      <div style={{ minWidth: 0 }}>
        <div className="k">{label}</div>
        <div className={disabled ? "v muted" : "v"}>{value}</div>
      </div>
      <button className="btn sm" onClick={onCopy} disabled={disabled}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
