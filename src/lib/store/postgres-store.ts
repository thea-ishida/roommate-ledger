import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Expense, HouseholdState, Member, Settlement } from "../types";
import { randomId } from "./ids";
import { NotFound } from "./json-store";
import type { Store } from "./types";

// Idempotent, so it is safe to run on every cold start.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS households (
    id text PRIMARY KEY,
    name text NOT NULL,
    currency text NOT NULL DEFAULT 'CAD',
    settle_day smallint NOT NULL DEFAULT 1 CHECK (settle_day BETWEEN 1 AND 28),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS members (
    id text PRIMARY KEY,
    household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name text NOT NULL,
    etransfer text,
    calendar_token text NOT NULL UNIQUE,
    active boolean NOT NULL DEFAULT true,
    position serial
  )`,
  `CREATE INDEX IF NOT EXISTS members_household_idx ON members (household_id)`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id text PRIMARY KEY,
    household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount_cents integer NOT NULL CHECK (amount_cents > 0),
    paid_by text NOT NULL REFERENCES members(id),
    date date NOT NULL,
    due_date date,
    split jsonb NOT NULL,
    shares jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS expenses_household_date_idx ON expenses (household_id, date)`,
  `CREATE TABLE IF NOT EXISTS settlements (
    id text PRIMARY KEY,
    household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    from_member text NOT NULL REFERENCES members(id),
    to_member text NOT NULL REFERENCES members(id),
    amount_cents integer NOT NULL CHECK (amount_cents > 0),
    date date NOT NULL,
    method text NOT NULL,
    status text NOT NULL DEFAULT 'sent',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS settlements_household_date_idx ON settlements (household_id, date)`,
];

type Row = Record<string, unknown>;

export function createPostgresStore(url: string): Store {
  const sql: NeonQueryFunction<false, false> = neon(url);
  let ready: Promise<void> | null = null;
  const migrate = () => (ready ??= (async () => {
    for (const stmt of SCHEMA) await sql.query(stmt);
  })().catch((err) => {
    ready = null;
    throw err;
  }));

  async function load(id: string): Promise<HouseholdState | null> {
    await migrate();
    const [h] = await sql`SELECT id, name, currency, settle_day, created_at::text FROM households WHERE id = ${id}`;
    if (!h) return null;
    const [members, expenses, settlements] = await Promise.all([
      sql`SELECT * FROM members WHERE household_id = ${id} ORDER BY position`,
      sql`SELECT id, description, amount_cents, paid_by, date::text AS date, due_date::text AS due_date,
                 split, shares, created_at::text AS created_at
          FROM expenses WHERE household_id = ${id}`,
      sql`SELECT id, from_member, to_member, amount_cents, date::text AS date, method, status,
                 created_at::text AS created_at
          FROM settlements WHERE household_id = ${id}`,
    ]);
    return {
      household: { id: h.id as string, name: h.name as string, currency: h.currency as string, settleDay: Number(h.settle_day), createdAt: h.created_at as string },
      members: members.map(toMember),
      expenses: expenses.map(toExpense),
      settlements: settlements.map(toSettlement),
    };
  }

  async function expectRow(rows: Row[]) {
    if (!rows.length) throw new NotFound();
  }

  return {
    async createHousehold(input) {
      await migrate();
      const id = randomId(12);
      const members = input.members.map((m) => ({ ...m, id: randomId(8), token: randomId(24) }));
      await sql.transaction([
        sql`INSERT INTO households (id, name, settle_day) VALUES (${id}, ${input.name}, ${input.settleDay})`,
        ...members.map(
          (m) => sql`INSERT INTO members (id, household_id, name, etransfer, calendar_token)
                     VALUES (${m.id}, ${id}, ${m.name}, ${m.etransfer}, ${m.token})`,
        ),
      ]);
      return (await load(id))!;
    },

    getHousehold: load,

    async updateHousehold(id, patch) {
      await migrate();
      await expectRow(await sql`
        UPDATE households SET
          name = COALESCE(${patch.name ?? null}, name),
          settle_day = COALESCE(${patch.settleDay ?? null}, settle_day)
        WHERE id = ${id} RETURNING id`);
    },

    async addMember(hid, m) {
      await migrate();
      await expectRow(await sql`SELECT 1 FROM households WHERE id = ${hid}`);
      const [row] = await sql`
        INSERT INTO members (id, household_id, name, etransfer, calendar_token)
        VALUES (${randomId(8)}, ${hid}, ${m.name}, ${m.etransfer}, ${randomId(24)}) RETURNING *`;
      return toMember(row);
    },

    async updateMember(hid, mid, patch) {
      await migrate();
      await expectRow(await sql`
        UPDATE members SET
          name = COALESCE(${patch.name ?? null}, name),
          etransfer = CASE WHEN ${"etransfer" in patch} THEN ${patch.etransfer ?? null} ELSE etransfer END,
          active = COALESCE(${patch.active ?? null}, active)
        WHERE id = ${mid} AND household_id = ${hid} RETURNING id`);
    },

    async addExpense(hid, e) {
      await migrate();
      await sql`
        INSERT INTO expenses (id, household_id, description, amount_cents, paid_by, date, due_date, split, shares)
        VALUES (${randomId(10)}, ${hid}, ${e.description}, ${e.amountCents}, ${e.paidBy}, ${e.date},
                ${e.dueDate}, ${JSON.stringify(e.split)}, ${JSON.stringify(e.shares)})`;
    },

    async deleteExpense(hid, eid) {
      await migrate();
      await expectRow(await sql`DELETE FROM expenses WHERE id = ${eid} AND household_id = ${hid} RETURNING id`);
    },

    async addSettlement(hid, s) {
      await migrate();
      await sql`
        INSERT INTO settlements (id, household_id, from_member, to_member, amount_cents, date, method)
        VALUES (${randomId(10)}, ${hid}, ${s.from}, ${s.to}, ${s.amountCents}, ${s.date}, ${s.method})`;
    },

    async updateSettlement(hid, sid, patch) {
      await migrate();
      await expectRow(await sql`
        UPDATE settlements SET status = ${patch.status}
        WHERE id = ${sid} AND household_id = ${hid} RETURNING id`);
    },

    async deleteSettlement(hid, sid) {
      await migrate();
      await expectRow(await sql`DELETE FROM settlements WHERE id = ${sid} AND household_id = ${hid} RETURNING id`);
    },

    async findByCalendarToken(token) {
      await migrate();
      const [m] = await sql`SELECT id, household_id FROM members WHERE calendar_token = ${token}`;
      if (!m) return null;
      const state = await load(m.household_id as string);
      return state && { state, memberId: m.id as string };
    },
  };
}

const toMember = (r: Row): Member => ({
  id: r.id as string,
  name: r.name as string,
  etransfer: (r.etransfer as string | null) ?? null,
  calendarToken: r.calendar_token as string,
  active: r.active as boolean,
});

const toExpense = (r: Row): Expense => ({
  id: r.id as string,
  description: r.description as string,
  amountCents: Number(r.amount_cents),
  paidBy: r.paid_by as string,
  date: r.date as string,
  dueDate: (r.due_date as string | null) ?? null,
  split: r.split as Expense["split"],
  shares: r.shares as Expense["shares"],
  createdAt: r.created_at as string,
});

const toSettlement = (r: Row): Settlement => ({
  id: r.id as string,
  from: r.from_member as string,
  to: r.to_member as string,
  amountCents: Number(r.amount_cents),
  date: r.date as string,
  method: r.method as Settlement["method"],
  status: r.status as Settlement["status"],
  createdAt: r.created_at as string,
});
