import { body, handle, loadHousehold, settleDay, text } from "@/lib/api";
import { getStore } from "@/lib/store";

type Ctx = RouteContext<"/api/households/[id]">;

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return Response.json(await loadHousehold(id));
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = await body(req);
  await getStore().updateHousehold(id, {
    ...(b.name !== undefined && { name: text(b.name, "Household name", 60) }),
    ...(b.settleDay !== undefined && { settleDay: settleDay(b.settleDay) }),
  });
  return Response.json(await loadHousehold(id));
});
