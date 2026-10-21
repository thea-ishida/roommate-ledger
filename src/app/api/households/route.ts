import { BadRequest, body, handle, optionalText, settleDay, text } from "@/lib/api";
import { getStore } from "@/lib/store";

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  if (!Array.isArray(b.members) || b.members.length < 2 || b.members.length > 12) {
    throw new BadRequest("Add between 2 and 12 roommates");
  }
  const members = b.members.map((m: Record<string, unknown>) => ({
    name: text(m?.name, "Roommate name", 40),
    etransfer: optionalText(m?.etransfer, "e-Transfer contact"),
  }));
  const state = await getStore().createHousehold({
    name: text(b.name, "Household name", 60),
    settleDay: settleDay(b.settleDay),
    members,
  });
  return Response.json(state, { status: 201 });
});
