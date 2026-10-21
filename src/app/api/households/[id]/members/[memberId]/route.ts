import { body, handle, loadHousehold, optionalText, text } from "@/lib/api";
import { getStore } from "@/lib/store";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/households/[id]/members/[memberId]">) => {
  const { id, memberId } = await ctx.params;
  const b = await body(req);
  await getStore().updateMember(id, memberId, {
    ...(b.name !== undefined && { name: text(b.name, "Name", 40) }),
    ...(b.etransfer !== undefined && { etransfer: optionalText(b.etransfer, "e-Transfer contact") }),
    ...(typeof b.active === "boolean" && { active: b.active }),
  });
  return Response.json(await loadHousehold(id));
});
