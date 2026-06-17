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
