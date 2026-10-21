import { body, handle, loadHousehold, parseExpense } from "@/lib/api";
import { getStore } from "@/lib/store";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/households/[id]/expenses">) => {
  const { id } = await ctx.params;
  const expense = parseExpense(await loadHousehold(id), await body(req));
  await getStore().addExpense(id, expense);
  return Response.json(await loadHousehold(id), { status: 201 });
});
