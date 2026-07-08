import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Missing VITE_SUPABASE_URL or Supabase anon key");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

export const ACTIVE_ORGANIZATION_ID_STORAGE_KEY = "active-organization-id";

export function getActiveOrganizationId() {
  try {
    return localStorage.getItem(ACTIVE_ORGANIZATION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearActiveOrganizationId() {
  try {
    localStorage.removeItem(ACTIVE_ORGANIZATION_ID_STORAGE_KEY);
  } catch {
    // Ignore storage failures; auth should still proceed.
  }
}
