import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import { withReasoningHeader } from "./model-settings";
import { REASONING_HEADER } from "../../shared/model-settings";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
const modelProcedure = t.procedure.use(({ ctx, next }) =>
  withReasoningHeader(ctx.req?.headers?.[REASONING_HEADER], () => next())
);
export const publicProcedure = modelProcedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = modelProcedure.use(requireUser);

const requireOrganization = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.organization || !ctx.membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization membership",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      organization: ctx.organization,
      membership: ctx.membership,
    },
  });
});

export const organizationProcedure = modelProcedure.use(requireOrganization);

export const adminProcedure = modelProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
