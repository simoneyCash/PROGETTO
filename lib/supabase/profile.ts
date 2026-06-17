import { createClient } from "./server";

export type AppRole = "admin" | "coach" | "client";

export type Profile = {
  id: string;
  tenant_id: string;
  role: AppRole;
  full_name: string | null;
  email: string | null;
};

export function isStaff(role: AppRole | undefined | null): boolean {
  return role === "admin" || role === "coach";
}

/**
 * Utente autenticato + il suo profilo (ruolo/tenant) da `profiles`.
 * `profile` è null se l'account auth esiste ma non è ancora collegato a un
 * tenant (situazione da onboarding). La RLS permette di leggere solo il
 * proprio profilo.
 */
export async function getCurrentProfile(): Promise<{
  userId: string | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, profile: (profile as Profile | null) ?? null };
}
