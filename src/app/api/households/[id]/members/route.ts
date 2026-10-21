import { body, handle, loadHousehold, optionalText, text } from "@/lib/api";
import { getStore } from "@/lib/store";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/households/[id]/members">) => {
  const { id } = await ctx.params;
  const b = await body(req);
  await getStore().addMember(id, {
    name: text(b.name, "Name", 40),
    etransfer: optionalText(b.etransfer, "e-Transfer contact"),
  });
  return Response.json(await loadHousehold(id), { status: 201 });
});
