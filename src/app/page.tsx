import { CreateHousehold } from "@/components/CreateHousehold";

export default function Home() {
  return (
    <main className="page">
      <div className="top">
        <span className="brand">Roommate Ledger</span>
      </div>
      <h1>Split the bills. Keep it even.</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Add shared expenses, split them however you like, and see a running total for the month. Settle up by
        Interac e-Transfer and get a calendar reminder when it&apos;s time to pay.
      </p>
      <CreateHousehold />
    </main>
  );
}
