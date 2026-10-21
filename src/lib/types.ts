export type SplitType = "equal" | "exact" | "percent" | "shares";

export interface Household {
  id: string;
  name: string;
  currency: string;
  /** Day of the month (1–28) when roommates settle up. Drives calendar reminders. */
  settleDay: number;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  /** Email or phone the member receives Interac e-Transfers at. */
  etransfer: string | null;
  /** Secret token for this member's calendar subscription feed. */
  calendarToken: string;
  active: boolean;
}

export interface SplitSpec {
  type: SplitType;
  /**
   * Per-member input, keyed by member id. Meaning depends on `type`:
   * equal → 1 to include; exact → cents; percent → percent; shares → weight.
   */
  values: Record<string, number>;
}

export interface Expense {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
  /** YYYY-MM-DD the expense happened. Decides which month it counts toward. */
  date: string;
  /** Optional YYYY-MM-DD the bill is due. Shown in calendar reminders. */
  dueDate: string | null;
  split: SplitSpec;
  /** What each member owes, in cents. Always sums to amountCents. */
  shares: Record<string, number>;
  createdAt: string;
}

export type SettlementStatus = "sent" | "received";

export interface Settlement {
  id: string;
  from: string;
  to: string;
  amountCents: number;
  date: string;
  method: "etransfer" | "cash" | "other";
  status: SettlementStatus;
  createdAt: string;
}

export interface HouseholdState {
  household: Household;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
}

export interface NewExpense {
  description: string;
  amountCents: number;
  paidBy: string;
  date: string;
  dueDate: string | null;
  split: SplitSpec;
}

export interface NewSettlement {
  from: string;
  to: string;
  amountCents: number;
  date: string;
  method: Settlement["method"];
}
