import { promises as fs } from "node:fs";
import path from "node:path";
import type { HouseholdState } from "../types";
import { randomId } from "./ids";
import type { Store } from "./types";

type Db = Record<string, HouseholdState>;

/**
 * Zero-setup store for local development: the whole ledger lives in one JSON
 * file. Not for production — serverless filesystems are ephemeral.
 */
export function createJsonStore(file: string): Store {
  let queue = Promise.resolve();

  async function read(): Promise<Db> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  /** Serializes read-modify-write so concurrent requests don't clobber each other. */
  function mutate<T>(householdId: string, fn: (s: HouseholdState) => T): Promise<T> {
    const run = queue.then(async () => {
      const db = await read();
      const state = db[householdId];
      if (!state) throw new NotFound();
      const result = fn(state);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(db, null, 2));
      return result;
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  return {
    async createHousehold(input) {
      const id = randomId(12);
      const state: HouseholdState = {
        household: { id, name: input.name, currency: "CAD", settleDay: input.settleDay, createdAt: new Date().toISOString() },
        members: input.members.map((m) => ({ id: randomId(8), name: m.name, etransfer: m.etransfer, calendarToken: randomId(24), active: true })),
        expenses: [],
        settlements: [],
      };
      const run = queue.then(async () => {
        const db = await read();
        db[id] = state;
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, JSON.stringify(db, null, 2));
      });
      queue = run.catch(() => undefined);
      await run;
      return state;
    },

    async getHousehold(id) {
      await queue;
      return (await read())[id] ?? null;
    },

    updateHousehold: (id, patch) => mutate(id, (s) => void Object.assign(s.household, patch)),

    addMember: (hid, m) =>
      mutate(hid, (s) => {
        const member = { id: randomId(8), name: m.name, etransfer: m.etransfer, calendarToken: randomId(24), active: true };
        s.members.push(member);
        return member;
      }),

    updateMember: (hid, mid, patch) => mutate(hid, (s) => void Object.assign(find(s.members, mid), patch)),

    addExpense: (hid, e) =>
      mutate(hid, (s) => void s.expenses.push({ ...e, id: randomId(10), createdAt: new Date().toISOString() })),

    deleteExpense: (hid, eid) =>
      mutate(hid, (s) => {
        find(s.expenses, eid);
        s.expenses = s.expenses.filter((x) => x.id !== eid);
      }),

    addSettlement: (hid, x) =>
      mutate(hid, (s) => void s.settlements.push({ ...x, id: randomId(10), status: "sent", createdAt: new Date().toISOString() })),

    updateSettlement: (hid, sid, patch) => mutate(hid, (s) => void Object.assign(find(s.settlements, sid), patch)),

    deleteSettlement: (hid, sid) =>
      mutate(hid, (s) => {
        find(s.settlements, sid);
        s.settlements = s.settlements.filter((x) => x.id !== sid);
      }),

    async findByCalendarToken(token) {
      await queue;
      for (const state of Object.values(await read())) {
        const m = state.members.find((x) => x.calendarToken === token);
        if (m) return { state, memberId: m.id };
      }
      return null;
    },
  };
}

export class NotFound extends Error {
  constructor() {
    super("Not found");
  }
}

function find<T extends { id: string }>(list: T[], id: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new NotFound();
  return item;
}
