import { protectedProcedure, router } from "../_core/trpc";
import { assertBtboludismoAccess } from "../btboludismoAccess";

const privateBtboludismoProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  await assertBtboludismoAccess(ctx.user);
  return next({ ctx });
});

export const btboludismoRouter = router({
  access: privateBtboludismoProcedure.query(() => ({
    url: "https://btboludismo.williancunha.chatgpt.site",
  })),
});
