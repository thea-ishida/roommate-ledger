import { handle, loadHousehold } from "@/lib/api";
import { getStore } from "@/lib/store";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/households/[id]/expenses/[expenseId]">) => {
  const { id, expenseId } = await ctx.params;
  await getStore().deleteExpense(id, expenseId);
  return Response.json(await loadHousehold(id));
});
