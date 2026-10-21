"use client";

import { useEffect, useRef, useState } from "react";
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, type Reminder } from "@/lib/calendar";

/** One-off "add this to my calendar" for a single payment. */
export function ReminderMenu({ reminder, label = "Remind me" }: { reminder: Reminder; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function downloadIcs() {
    const blob = new Blob([buildIcs([reminder])], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "payment-reminder.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    setOpen(false);
  }

  return (
    <div className="menu" ref={ref}>
      <button className="btn sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {label}
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <a href={googleCalendarUrl(reminder)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            Google Calendar
          </a>
          <a href={outlookCalendarUrl(reminder)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            Outlook
          </a>
          <button onClick={downloadIcs}>Apple / other (.ics)</button>
        </div>
      )}
    </div>
  );
}
