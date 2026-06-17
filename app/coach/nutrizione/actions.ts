"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

// Crea un piano nutrizionale come BOZZA (mai auto-pubblicato: human-in-the-loop).
export async function createNutritionPlan(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!clientId) {
    redirect("/coach/nutrizione?error=" + encodeURIComponent("Scegli un cliente"));
  }
  if (!title) {
    redirect(
      "/coach/nutrizione?error=" + encodeURIComponent("Dai un titolo al piano"),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nutrition_plans")
    .insert({
      tenant_id: profile.tenant_id, // RLS: tenant del coach
      client_id: clientId,
      title,
      content: { text: body },
      status: "draft",
      created_by: profile.id,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    redirect("/coach/nutrizione?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/coach/nutrizione");
  if (data?.id) redirect(`/coach/nutrizione/${data.id}`);
  redirect("/coach/nutrizione");
}

// Il coach approva e pubblica il piano: diventa visibile al cliente (RLS:
// il cliente vede SOLO i piani 'published').
export async function publishNutritionPlan(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const id = String(formData.get("plan_id") ?? "");
  if (!id) redirect("/coach/nutrizione");

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("nutrition_plans")
    .update({
      status: "published",
      reviewed_by: profile.id,
      approved_at: now,
      published_at: now,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/coach/nutrizione/${id}?error=` + encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/coach/nutrizione/${id}`);
  redirect(`/coach/nutrizione/${id}?published=1`);
}

// Chiama la Edge Function che genera la BOZZA di piano alimentare con l'AI.
// Specchio di generateProgramDraft (app/coach/actions.ts).
export async function generateNutritionDraft(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) {
    redirect("/coach/nutrizione?error=" + encodeURIComponent("Scegli un cliente"));
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("generate-nutrition", {
    body: { client_id: clientId },
    headers: session
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
  });

  if (error) {
    redirect(
      "/coach/nutrizione?error=" +
        encodeURIComponent("Generazione AI non riuscita: " + error.message),
    );
  }
  if (data?.error) {
    redirect("/coach/nutrizione?error=" + encodeURIComponent(data.error));
  }

  revalidatePath("/coach/nutrizione");
  if (data?.plan_id) redirect(`/coach/nutrizione/${data.plan_id}`);
  redirect("/coach/nutrizione");
}

// --- Editor del piano: il coach modifica la bozza strutturata prima di pubblicare.

type EditorItem = { food: string; quantity: string };
type EditorMeal = { name: string; items: EditorItem[]; notes: string };
type EditorContent = {
  title: string;
  summary: string;
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: EditorMeal[];
  coach_notes: string;
  health_flags: string[];
};

const clampStr = (s: unknown, max: number) => String(s ?? "").slice(0, max);
const toInt = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

// Salva le modifiche del coach alla bozza di piano. Con intent="publish" salva E
// pubblica. Invarianti: una versione pubblicata/archiviata non è più editabile;
// normalizzazione lato server (niente dato arbitrario nel DB); health_flags
// segnalati dall'AI preservati (non editabili qui). Specchio di saveProgramVersion.
export async function saveNutritionPlan(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) redirect("/");

  const planId = String(formData.get("plan_id") ?? "");
  const intent = String(formData.get("intent") ?? "save"); // "save" | "publish"
  if (!planId) redirect("/coach/nutrizione");

  const fail = (msg: string): never =>
    redirect(`/coach/nutrizione/${planId}?error=` + encodeURIComponent(msg));

  let incoming: Partial<EditorContent>;
  try {
    incoming = JSON.parse(String(formData.get("content") ?? "{}"));
  } catch {
    fail("Contenuto non valido, riprova.");
  }

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("nutrition_plans")
    .select("id, status, content")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) fail("Piano non trovato.");
  if (plan!.status === "published" || plan!.status === "archived") {
    fail("Questo piano non è più una bozza: non è modificabile.");
  }

  const prev = (plan!.content ?? {}) as Partial<EditorContent>;
  const mealsIn = Array.isArray(incoming!.meals) ? incoming!.meals.slice(0, 30) : [];
  const meals: EditorMeal[] = mealsIn.map((m) => ({
    name: clampStr(m?.name, 120),
    notes: clampStr(m?.notes, 1000),
    items: (Array.isArray(m?.items) ? m.items.slice(0, 50) : []).map((it) => ({
      food: clampStr(it?.food, 200),
      quantity: clampStr(it?.quantity, 60),
    })),
  }));

  const content: EditorContent = {
    title:
      clampStr(incoming!.title, 200) ||
      clampStr(prev.title, 200) ||
      "Piano alimentare",
    summary: clampStr(incoming!.summary, 1000),
    daily_calories: toInt(incoming!.daily_calories, 0, 10000),
    protein_g: toInt(incoming!.protein_g, 0, 2000),
    carbs_g: toInt(incoming!.carbs_g, 0, 2000),
    fat_g: toInt(incoming!.fat_g, 0, 2000),
    // health_flags: non editabili qui -> preservo quelli segnalati dall'AI.
    health_flags: Array.isArray(prev.health_flags)
      ? prev.health_flags.map((f) => clampStr(f, 300)).slice(0, 30)
      : [],
    coach_notes: clampStr(incoming!.coach_notes, 2000),
    meals,
  };

  // Non pubblicare un piano vuoto: il cliente vedrebbe solo un titolo.
  if (intent === "publish" && content.meals.length === 0) {
    fail("Aggiungi almeno un pasto prima di pubblicare il piano.");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    content,
    title: content.title,
    updated_at: now,
  };
  if (intent === "publish") {
    patch.status = "published";
    patch.reviewed_by = profile.id;
    patch.approved_at = now;
    patch.published_at = now;
  }

  const { error: upErr } = await supabase
    .from("nutrition_plans")
    .update(patch)
    .eq("id", planId)
    .eq("tenant_id", profile.tenant_id); // difesa in profondità oltre alla RLS
  if (upErr) fail(upErr.message);

  revalidatePath(`/coach/nutrizione/${planId}`);
  redirect(
    `/coach/nutrizione/${planId}?` + (intent === "publish" ? "published=1" : "saved=1"),
  );
}
