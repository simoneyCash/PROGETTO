/**
 * Reads and validates the public Supabase environment variables.
 * Fails loudly with an actionable message instead of a cryptic runtime error
 * when .env.local is missing or incomplete.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase non configurato: imposta NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (vedi .env.example).",
    );
  }

  return { url, anonKey };
}
