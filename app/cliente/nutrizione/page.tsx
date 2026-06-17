import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

function planText(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const t = (content as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return "";
}

export default async function ClientNutrition() {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, title, content, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/cliente"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ La tua scheda
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">Piano alimentare</h1>
      </header>

      <section className="mt-6">
        {!plan ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 text-center text-sm text-neutral-300">
            Nessun piano alimentare pubblicato ancora. Comparirà qui quando il
            coach lo pubblica.
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="font-semibold">{plan.title ?? "Piano"}</h2>
            {planText(plan.content) ? (
              <p className="mt-3 whitespace-pre-wrap border-t border-neutral-800 pt-3 text-sm text-neutral-300">
                {planText(plan.content)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">
                Il coach non ha ancora aggiunto il contenuto.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
