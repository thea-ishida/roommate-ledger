import { body, handle, loadHousehold, parseSettlement } from "@/lib/api";
import { getStore } from "@/lib/store";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/households/[id]/settlements">) => {
  const { id } = await ctx.params;
  const settlement = parseSettlement(await loadHousehold(id), await body(req));
  await getStore().addSettlement(id, settlement);
  return Response.json(await loadHousehold(id), { status: 201 });
});
