import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { publishNutritionPlan } from "../actions";
import { ARTIFACT_STATUS } from "../status";

type Plan = {
  id: string;
  client_id: string;
  title: string | null;
  status: string;
  content: unknown;
};

function planText(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const t = (content as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return "";
}

export default async function NutritionDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string; error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { published, error } = await searchParams;

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, client_id, title, status, content")
    .eq("id", id)
    .maybeSingle();

  if (!plan) notFound();
  const p = plan as Plan;

  const { data: client } = await supabase
    .from("clients")
    .select("full_name")
    .eq("id", p.client_id)
    .maybeSingle();

  const s = ARTIFACT_STATUS[p.status] ?? {
    label: p.status,
    className: "bg-neutral-700/40 text-neutral-300",
  };
  const body = planText(p.content);
  const isPublished = p.status === "published";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/coach/nutrizione"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ Tutti i piani
      </Link>

      <header className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{p.title ?? "Senza titolo"}</h1>
          <p className="text-sm text-neutral-500">
            {client?.full_name ?? "Cliente"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${s.className}`}
        >
          {s.label}
        </span>
      </header>

      {published && (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Piano pubblicato: ora è visibile al cliente.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">Contenuto</h2>
        <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          {body ? (
            <p className="whitespace-pre-wrap text-sm text-neutral-200">
              {body}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              Nessun contenuto. (Più avanti l&apos;AI potrà generarlo dalla
              scheda del cliente.)
            </p>
          )}
        </div>
      </section>

      {!isPublished && (
        <form action={publishNutritionPlan} className="mt-8">
          <input type="hidden" name="plan_id" value={p.id} />
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500"
          >
            Approva e pubblica
          </button>
          <p className="mt-2 text-xs text-neutral-500">
            Finché è una bozza, il cliente non la vede.
          </p>
        </form>
      )}
    </main>
  );
}
