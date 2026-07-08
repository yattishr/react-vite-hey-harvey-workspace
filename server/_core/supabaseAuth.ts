import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Request } from "express";
import https from "node:https";
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

function assertSupabaseAuthConfig() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    throw new Error("Supabase auth is not configured");
  }
}

async function getSupabaseUser(token: string) {
  assertSupabaseAuthConfig();

  const url = new URL("/auth/v1/user", ENV.supabaseUrl);
  const response = await fetchSupabaseAuthUser(url, token);

  if (!response.ok) {
    console.warn("[Auth] Supabase token verification failed", {
      status: response.status,
      message: response.body,
    });
    return null;
  }

  return JSON.parse(response.body) as SupabaseUser;
}

async function fetchSupabaseAuthUser(url: URL, token: string) {
  try {
    const response = await fetch(url, {
      headers: {
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await response.text(),
    };
  } catch (error) {
    if (!ENV.isProduction && isCertificateChainError(error)) {
      console.warn(
        "[Auth] Supabase Auth TLS verification failed; retrying with local development TLS fallback"
      );
      return fetchSupabaseAuthUserWithInsecureTls(url, token);
    }

    throw error;
  }
}

function isCertificateChainError(error: unknown) {
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
}

function fetchSupabaseAuthUserWithInsecureTls(url: URL, token: string) {
  return new Promise<{ ok: boolean; status: number; body: string }>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        rejectUnauthorized: false,
        headers: {
          apikey: ENV.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
      },
      response => {
        const chunks: Buffer[] = [];

        response.on("data", chunk => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    request.on("error", reject);
    request.end();
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

  const supabaseUser = await getSupabaseUser(token);

  if (!supabaseUser) {
    return null;
  }

  const user = await db.upsertSupabaseUser({
    supabaseUserId: supabaseUser.id,
    email: supabaseUser.email ?? null,
    name: getSupabaseDisplayName(supabaseUser),
    loginMethod: getSupabaseLoginMethod(supabaseUser),
  });

  if (!user) {
    console.warn("[Auth] Local user could not be loaded after Supabase sync");
    return null;
  }

  const requestedOrganizationId = getRequestedOrganizationId(req);
  let resolvedMembership = requestedOrganizationId
    ? await db.getOrganizationMembership(user.id, requestedOrganizationId)
    : null;

  if (requestedOrganizationId && !resolvedMembership) {
    console.warn(
      "[Auth] Requested organization is unavailable for user; falling back to default organization",
      { userId: user.id, requestedOrganizationId }
    );
  }

  resolvedMembership ??= await db.ensureDefaultOrganizationForUser(user);

  if (!resolvedMembership) {
    console.warn("[Auth] No organization membership found for user", user.id);
    return null;
  }

  return {
    user,
    organization: resolvedMembership.organization,
    membership: resolvedMembership.membership,
    supabaseUser,
  };
}
