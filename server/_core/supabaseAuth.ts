import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { Request } from "express";
import type { Organization, OrganizationMember, User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type AuthenticatedSession = {
  user: User;
  organization: Organization;
  membership: OrganizationMember;
  supabaseUser: SupabaseUser;
};

function getBearerToken(req: Request) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string") return null;
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function getRequestedOrganizationId(req: Request) {
  const value = req.headers["x-organization-id"];
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSupabaseAuthClient() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    throw new Error("Supabase auth is not configured");
  }

  return createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getSupabaseDisplayName(user: SupabaseUser) {
  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name;
  return typeof fullName === "string" && fullName.length > 0
    ? fullName
    : user.email ?? "User";
}

function getSupabaseLoginMethod(user: SupabaseUser) {
  const provider = user.app_metadata?.provider;
  return typeof provider === "string" && provider.length > 0 ? provider : "supabase";
}

export async function authenticateSupabaseRequest(
  req: Request
): Promise<AuthenticatedSession | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    console.warn("[Auth] Supabase token verification failed", error?.message);
    return null;
  }

  const user = await db.upsertSupabaseUser({
    supabaseUserId: data.user.id,
    email: data.user.email ?? null,
    name: getSupabaseDisplayName(data.user),
    loginMethod: getSupabaseLoginMethod(data.user),
  });

  if (!user) {
    console.warn("[Auth] Local user could not be loaded after Supabase sync");
    return null;
  }

  const requestedOrganizationId = getRequestedOrganizationId(req);
  const resolvedMembership = requestedOrganizationId
    ? await db.getOrganizationMembership(user.id, requestedOrganizationId)
    : await db.ensureDefaultOrganizationForUser(user);

  if (!resolvedMembership) {
    console.warn("[Auth] No organization membership found for user", user.id);
    return null;
  }

  return {
    user,
    organization: resolvedMembership.organization,
    membership: resolvedMembership.membership,
    supabaseUser: data.user,
  };
}
