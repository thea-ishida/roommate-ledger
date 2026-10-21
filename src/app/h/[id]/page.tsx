import { Suspense } from "react";
import { HouseholdApp } from "@/components/HouseholdApp";

export default function HouseholdPage({ params }: PageProps<"/h/[id]">) {
  return (
    <Suspense fallback={<main className="page muted">Loading…</main>}>
      <Household params={params} />
    </Suspense>
  );
}

async function Household({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HouseholdApp id={id} />;
}
