import type { Household, HouseholdState, Member, NewExpense, NewSettlement, Settlement } from "../types";

export interface NewHousehold {
  name: string;
  settleDay: number;
  members: { name: string; etransfer: string | null }[];
}

/**
 * Everything the API needs from persistence. Swap implementations (JSON file,
 * Postgres, Supabase, a separate service…) without touching routes or UI.
 */
export interface Store {
  createHousehold(input: NewHousehold): Promise<HouseholdState>;
  getHousehold(id: string): Promise<HouseholdState | null>;
  updateHousehold(id: string, patch: Partial<Pick<Household, "name" | "settleDay">>): Promise<void>;

  addMember(householdId: string, m: { name: string; etransfer: string | null }): Promise<Member>;
  updateMember(householdId: string, memberId: string, patch: Partial<Pick<Member, "name" | "etransfer" | "active">>): Promise<void>;

  addExpense(householdId: string, e: NewExpense & { shares: Record<string, number> }): Promise<void>;
  deleteExpense(householdId: string, expenseId: string): Promise<void>;

  addSettlement(householdId: string, s: NewSettlement): Promise<void>;
  updateSettlement(householdId: string, settlementId: string, patch: Pick<Settlement, "status">): Promise<void>;
  deleteSettlement(householdId: string, settlementId: string): Promise<void>;

  findByCalendarToken(token: string): Promise<{ state: HouseholdState; memberId: string } | null>;
}
