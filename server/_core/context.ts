import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Organization, OrganizationMember, User } from "../../drizzle/schema";
import { authenticateSupabaseRequest } from "./supabaseAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  organization: Organization | null;
  membership: OrganizationMember | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let organization: Organization | null = null;
  let membership: OrganizationMember | null = null;

  try {
    const session = await authenticateSupabaseRequest(opts.req);
    user = session?.user ?? null;
    organization = session?.organization ?? null;
    membership = session?.membership ?? null;
  } catch (error) {
    // Authentication is optional for public procedures.
    console.warn("[Auth] Failed to build auth context", error);
    user = null;
    organization = null;
    membership = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    organization,
    membership,
  };
}
