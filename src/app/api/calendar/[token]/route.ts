import { buildIcs, remindersFor } from "@/lib/calendar";
import { getStore } from "@/lib/store";

/**
 * Per-member calendar subscription feed. Calendar apps poll this URL on their
 * own schedule, so reminders stay in sync with balances with no OAuth and no
 * background jobs. The token in the URL is the only credential.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token } = await ctx.params;
  const found = await getStore().findByCalendarToken(token.replace(/\.ics$/, ""));
  if (!found) return new Response("Not found", { status: 404 });

  const { state, memberId } = found;
  const appUrl = new URL(`/h/${state.household.id}`, req.url).toString();
  const me = state.members.find((m) => m.id === memberId)!;
  const ics = buildIcs(remindersFor(state, memberId, appUrl), `${state.household.name} · ${me.name}`);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="roommate-ledger.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
