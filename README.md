# Roommate Ledger

A minimalist shared-expense tracker for roommates, in the spirit of Splitwise and [Harambee Ledger](https://github.com/thea-ishida/harambee-ledger). It started as a single-file browser ledger and is now a full-stack app with a real backend that the whole household shares.

- **Add expenses and split them your way:** equally, by exact amounts, by percent, or by shares. The math is in whole cents and the shares always add up to the total.
- **Running monthly total:** each month shows what was spent, everyone's share, what carried over from earlier months, and the running balance.
- **Settle up in the fewest transfers:** the app works out who pays whom.
- **Pay by Interac e-Transfer:** pick your bank, sign in on the bank's own site, paste the prefilled recipient, amount and memo, then mark the payment *Sent*. The recipient marks it *Received*.
- **Calendar reminders:**
  - Add a single payment to Google Calendar, Outlook, or Apple Calendar (.ics).
  - Or subscribe to a personal feed that updates itself as balances change.

Built with Next.js 16 (App Router), TypeScript, and Postgres (Neon), and deployed on Vercel.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # ledger + calendar unit tests
```

Local development needs no database. Without `DATABASE_URL`, data goes in `.data/ledger.json`.

## Deploy to Vercel

1. Push this repo to GitHub, then in Vercel choose **Add New → Project** and import it.
2. In the project, open **Storage → Create Database → Neon (Postgres)** and connect it. Vercel sets `DATABASE_URL` for you.
3. Deploy. Tables are created on the first request. The schema is in [`src/lib/store/postgres-store.ts`](src/lib/store/postgres-store.ts).

If you deploy without a database, the app still runs, but it writes to the function's temporary disk and the data is lost.

## How it's built

```
src/
  app/
    page.tsx                         Landing page: create a household
    h/[id]/page.tsx                  The household app (private link)
    api/households/...               REST API (route handlers)
    api/calendar/[token]/route.ts    Per-roommate .ics subscription feed
  components/                        Client UI (dialogs, settings, pay flow)
  lib/
    ledger.ts                        Split math, balances, settle-up, monthly summary (pure, tested)
    calendar.ts                      ICS builder, Google/Outlook links, reminder generation (pure, tested)
    banks.ts                         Bank sign-in URLs for the e-Transfer hand-off
    store/                           Storage interface + JSON-file and Postgres implementations
```

All the money logic is plain TypeScript in `lib/`. The client uses it to preview splits live, and the server uses the same code to validate them. Storage sits behind a small `Store` interface (`lib/store/types.ts`), so you can swap the backend without changing the routes or the UI.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/households` | Create a household with its roommates |
| `GET` / `PATCH` | `/api/households/:id` | Read the full state, or rename it / change the settle day |
| `POST` | `/api/households/:id/members` | Add a roommate |
| `PATCH` | `/api/households/:id/members/:memberId` | Edit a name or e-Transfer contact, or mark moved out |
| `POST` | `/api/households/:id/expenses` | Add an expense (`split: { type, values }`) |
| `DELETE` | `/api/households/:id/expenses/:expenseId` | Delete an expense |
| `POST` | `/api/households/:id/settlements` | Record a payment (status `sent`) |
| `PATCH` / `DELETE` | `/api/households/:id/settlements/:id` | Confirm (`received`) or delete a payment |
| `GET` | `/api/calendar/:token.ics` | A roommate's live reminder feed |

Every write returns the updated household state.

---

## Backend options

The default stack is **Next.js route handlers + Neon Postgres**: one repo, one Vercel deploy, and a free tier that covers a household with room to spare. These alternatives also fit:

| Option | What changes | Good when | Trade-offs |
| --- | --- | --- | --- |
| **A. Next.js API + Neon Postgres** *(implemented)* | Nothing | You want one repo and one deploy, with real SQL | You build auth yourself if you need it |
| **B. Next.js + Supabase** | Add a `supabase-store.ts` that implements `Store`; optionally use Supabase Auth and Realtime | You want magic-link login and live updates when a roommate adds an expense | Another vendor dashboard; row-level security policies to learn |
| **C. Next.js + Drizzle/Prisma ORM** | Replace the raw SQL in `postgres-store.ts` with a typed schema and migrations | The schema will grow (categories, receipts, recurring bills) | More tooling and a build step for migrations |
| **D. Separate API service** (FastAPI, Go, or Express on Railway/Fly/Render) | Point `lib/client.ts` at the external URL; Vercel hosts only the frontend | You want to show backend work in another language, or need long-running workers | Two deploys, CORS, and secrets in two places |
| **E. Firebase / Firestore** | A document-store `Store` and client SDK listeners | You want offline support and real-time sync with minimal backend code | NoSQL makes balance queries harder; vendor lock-in |

For a portfolio piece, **A** (what's here) or **D** with a typed Python or Go service show the most backend skill. **B** gets you login and real-time updates the fastest.

## Calendar automation options

The goal: each roommate gets a reminder when they owe money, without having to remember to add it. Here are the approaches from simplest to most automated:

| Approach | How it works | Setup | Notes |
| --- | --- | --- | --- |
| **One-off links / .ics** *(implemented)* | A **Remind** button opens a prefilled Google or Outlook event, or downloads an `.ics` file for Apple Calendar | None | Manual. The event doesn't change if the balance does |
| **ICS subscription feed** *(implemented)* | Each roommate subscribes once to `/api/calendar/<token>.ics`. Their calendar app re-fetches it on its own schedule, so new debts and due dates appear automatically | None (no OAuth, no jobs) | Google refreshes subscribed calendars every several hours, Apple and Outlook more often. Google ignores alarms in subscribed feeds |
| **Google Calendar API + scheduled job** | Roommates connect Google (OAuth, `calendar.events` scope). A job watches for changes and creates or updates events in their own calendar | OAuth app, token storage, a scheduler | Real events with real notifications. Triggers: **Vercel Cron** (simplest; on Hobby it runs once a day, UTC only, with no retries), **Upstash QStash** (scheduled or delayed HTTP calls with retries; fits "remind 2 days before due"), **Inngest** (event-driven steps such as `expense.created` → wait until the due date → create the event), **Trigger.dev** (long-running tasks with a realtime UI) |
| **Email/SMS nudges** | The same scheduler sends an email (Resend) or text (Twilio) with a "Pay now" link | Provider API key | Works for people who don't live in their calendar |
| **MCP server** | Run a Google Calendar MCP server (community servers like `@tobedoit/google-calendar-mcp`, or hosted ones from Workato and others) so an AI assistant such as Claude can read the ledger API and create events on request | MCP client config + Google OAuth | Good for on-demand requests ("put my rent reminders on my calendar"). It is not a background watcher: MCP runs only when the assistant is in use, so pair it with one of the scheduled approaches for anything that has to happen automatically |
| **No-code (Zapier, Make, Pipedream)** | Poll the household API or receive a webhook, then create the calendar event | A few clicks | Quick to try; per-task pricing and logic outside your repo |

**Recommended path:** the subscription feed covers most of what you need for free. If you want reminders pushed into people's calendars with notifications, add Google OAuth plus QStash or Inngest. Fire an `expense.created` event from the expenses route, schedule a step for the due date, and upsert the event with a stable ID (the feed's `UID`s already follow this pattern).

## About the e-Transfer hand-off

Interac doesn't offer a public API or deep link that starts an e-Transfer from a website. Transfers can only begin inside your own bank's app or online banking. So the **Pay** dialog:

1. shows the recipient's e-Transfer email, the amount, and a memo, each with a copy button,
2. opens your bank's sign-in page in a new tab. Your bank choice is remembered on that device, and the app never sees your banking details,
3. lets you mark the payment *Sent* when you come back, and the recipient then confirms *Received*.

Bank sign-in URLs are in [`src/lib/banks.ts`](src/lib/banks.ts). They were checked in October 2026; banks change them from time to time.

To fully automate collection, a business could use an Interac e-Transfer *Request Money* integration through a payments provider. That requires a business account and is out of scope here.

## Privacy and access

Each household lives at an unguessable link (about 68 bits). Anyone with the link can view and add expenses, the same model as tools like Splid and Tricount. Calendar feeds use a separate 24-character token for each roommate. To lock it down further, add authentication: Supabase Auth, Auth.js with email magic links, or Clerk all fit, and they plug into `lib/api.ts`.

## Ideas / roadmap

- Recurring bills (rent, internet) that post themselves each month
- Edit expenses; categories and a monthly breakdown chart
- Receipts (Vercel Blob)
- Magic-link login and real-time updates
- CSV export and import from Harambee Ledger's JSON format
