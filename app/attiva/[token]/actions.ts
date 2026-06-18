"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Trova l'id dell'utente auth con una certa email (l'admin API non ha un
// "getByEmail" diretto). Scala per il pilota; da paginare se gli utenti crescono.
async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const target = email.toLowerCase();
  const user = data?.users?.find((u) => u.email?.toLowerCase() === target);
  return user?.id ?? null;
}

// Il cliente attiva il proprio account dal link: sceglie la password, noi
// creiamo (o aggiorniamo) l'utente auth, il profilo 'client' nel tenant giusto e
// colleghiamo clients.profile_id — tutto lato server con la chiave di servizio.
// Poi facciamo il login e lo portiamo dentro l'app. Il token viene azzerato
// (uso singolo): un link trapelato dopo l'attivazione non vale più.
export async function activateAccount(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const back = (msg: string): never =>
    redirect(`/attiva/${token}?error=` + encodeURIComponent(msg));

  if (!token) redirect("/login");
  if (password.length < 8) back("La password deve avere almeno 8 caratteri.");
  if (password !== confirm) back("Le due password non coincidono.");

  const admin = createAdminClient();

  // Risolvi il cliente dal token (service role: clients non è leggibile dal browser).
  const { data: client } = await admin
    .from("clients")
    .select(
      "id, tenant_id, full_name, email, profile_id, access_token_expires_at",
    )
    .eq("access_token", token)
    .maybeSingle();

  const expired =
    !!client?.access_token_expires_at &&
    new Date(client.access_token_expires_at) < new Date();
  if (!client || expired || !client.email) {
    back("Link non valido o scaduto. Chiedi al coach un nuovo link.");
  }
  const c = client!;
  const email = c.email!;

  // 1) Utente auth: già collegato -> reset password; altrimenti crealo (o
  //    recupera un eventuale account esistente non ancora collegato).
  let userId: string | null = c.profile_id ?? null;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) back("Impossibile aggiornare la password: " + error.message);
  } else {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: c.full_name },
    });
    if (created?.user) {
      userId = created.user.id;
    } else {
      const existingId = await findAuthUserIdByEmail(admin, email);
      if (!existingId) {
        back("Impossibile creare l'accesso: " + (cErr?.message ?? "errore"));
      }
      userId = existingId;
      const { error: uErr } = await admin.auth.admin.updateUserById(userId!, {
        password,
        email_confirm: true,
      });
      if (uErr) back("Impossibile impostare la password: " + uErr.message);
    }
  }
  if (!userId) back("Attivazione non riuscita, riprova.");

  // 2) Profilo 'client' nel tenant del cliente (service role aggira il guard).
  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: userId!,
      tenant_id: c.tenant_id,
      role: "client",
      full_name: c.full_name,
      email,
    },
    { onConflict: "id" },
  );
  if (pErr) back("Impossibile creare il profilo: " + pErr.message);

  // 3) Collega il record cliente e brucia il token (uso singolo).
  const { error: lErr } = await admin
    .from("clients")
    .update({
      profile_id: userId,
      access_token: null,
      access_token_expires_at: null,
    })
    .eq("id", c.id);
  if (lErr) back("Impossibile collegare l'account: " + lErr.message);

  // 4) Login immediato (scrive i cookie di sessione) e dentro l'app.
  const supabase = await createServerSupabase();
  const { error: sErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (sErr) redirect("/login?activated=1");

  redirect("/");
}
