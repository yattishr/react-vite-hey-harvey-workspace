import { organizationProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { logInput } from "../../shared/logs";
import { searchLogs } from "./service";

export const logsRouter = router({
  search: organizationProcedure.input(logInput).query(({ ctx, input }) => {
    if (
      input.organizationId !== undefined &&
      input.organizationId !== ctx.organization.id
    )
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Organization changed. Reload Logs Explorer.",
      });
    return searchLogs(ctx.organization.id, input);
  }),
});
