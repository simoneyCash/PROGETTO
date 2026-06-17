"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";

type Exercise = { exercise_name: string; sets: number; reps: string };
type ProgramContent = {
  title: string;
  days: { label: string; exercises: Exercise[] }[];
};

// Il cliente registra un allenamento completato. I nomi degli esercizi e il
// numero di serie li prendiamo dal DB (versione pubblicata), non dal form:
// il client invia solo i valori (ripetizioni/peso). Salvataggio atomico via RPC.
export async function logWorkout(formData: FormData) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const dayIndex = Number(formData.get("day") ?? "");
  if (!Number.isInteger(dayIndex) || dayIndex < 0) redirect("/cliente");

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("program_versions")
    .select("id, content")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) redirect("/cliente");

  const content = version.content as ProgramContent;
  const day = content.days?.[dayIndex];
  if (!day) redirect("/cliente");

  const logs: {
    exercise_name: string;
    set_number: number;
    reps: string;
    weight: string;
  }[] = [];
  day.exercises?.forEach((ex, i) => {
    const setCount = Math.max(1, Number(ex.sets) || 1);
    for (let s = 1; s <= setCount; s++) {
      const reps = String(formData.get(`reps_${i}_${s}`) ?? "").trim();
      const weight = String(formData.get(`weight_${i}_${s}`) ?? "").trim();
      if (!reps && !weight) continue; // serie lasciata vuota: la saltiamo
      logs.push({ exercise_name: ex.exercise_name, set_number: s, reps, weight });
    }
  });

  if (logs.length === 0) {
    redirect(
      `/cliente/allenamento/${dayIndex}?error=` +
        encodeURIComponent("Inserisci almeno una serie."),
    );
  }

  const { error } = await supabase.rpc("client_log_workout", {
    p_program_version_id: version.id,
    p_title: day.label,
    p_logs: logs,
  });
  if (error) {
    redirect(
      `/cliente/allenamento/${dayIndex}?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/cliente");
  redirect("/cliente?logged=1");
}
