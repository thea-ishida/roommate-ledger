import { BadRequest, body, handle, loadHousehold } from "@/lib/api";
import { getStore } from "@/lib/store";

type Ctx = RouteContext<"/api/households/[id]/settlements/[settlementId]">;

/** The recipient confirms a payment arrived: sent → received. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id, settlementId } = await ctx.params;
  const { status } = await body(req);
  if (status !== "sent" && status !== "received") throw new BadRequest("Unknown status");
  await getStore().updateSettlement(id, settlementId, { status });
  return Response.json(await loadHousehold(id));
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { id, settlementId } = await ctx.params;
  await getStore().deleteSettlement(id, settlementId);
  return Response.json(await loadHousehold(id));
});
