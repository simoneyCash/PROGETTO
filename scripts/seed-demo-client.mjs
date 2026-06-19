// =============================================================================
// SEED — Cliente DEMO completo (per provare l'app cliente dal vivo).
//
// Crea/aggiorna un account cliente con: scheda pubblicata (3 giorni), piano
// alimentare pubblicato (calorie+macro+pasti), 2 allenamenti completati questa
// settimana (anello + week-strip ✓), un check-in da rispondere e un messaggio
// del coach. Idempotente: rilanciandolo, rigenera i dati demo da zero.
//
// USO:  node scripts/seed-demo-client.mjs
// Legge le chiavi da .env.local. Usa la SERVICE ROLE (bypassa RLS) come fa il
// flusso ufficiale di attivazione (app/attiva/[token]/actions.ts).
// NB: è un account di TEST nel tuo progetto di sviluppo — cambia la password
// quando vuoi. Per rimuoverlo: node scripts/seed-demo-client.mjs --remove
// =============================================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// — Carica .env.local —————————————————————————————————————————————————————————
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  console.error("Impossibile leggere .env.local");
  process.exit(1);
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const EMAIL = "marco.demo@example.com";
const PASSWORD = "Allenati2026!";
const FULL_NAME = "Marco Demo";
const REMOVE = process.argv.includes("--remove");

const admin = createClient(URL_, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const die = (msg, err) => {
  console.error("❌ " + msg, err?.message ?? err ?? "");
  process.exit(1);
};

// — Trova l'utente auth per email (l'admin API non ha getByEmail) ——————————————
async function findUserIdByEmail(email) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const t = email.toLowerCase();
  return data?.users?.find((u) => u.email?.toLowerCase() === t)?.id ?? null;
}

// — Tenant + coach ————————————————————————————————————————————————————————————
let { data: tenant } = await admin
  .from("tenants")
  .select("id, name")
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();

if (!tenant) {
  const { data, error } = await admin
    .from("tenants")
    .insert({ name: "Studio Demo", slug: "studio-demo" })
    .select("id, name")
    .single();
  if (error) die("Creazione tenant fallita", error);
  tenant = data;
  console.log("• Creato tenant:", tenant.name);
} else {
  console.log("• Tenant esistente:", tenant.name);
}

const { data: coach } = await admin
  .from("profiles")
  .select("id, full_name")
  .eq("tenant_id", tenant.id)
  .eq("role", "coach")
  .limit(1)
  .maybeSingle();
const coachId = coach?.id ?? null;
console.log("• Coach:", coach?.full_name ?? "(nessuno: coach_id resterà vuoto)");

// — Utente auth (crea o riusa, come l'attivazione) —————————————————————————————
let userId = await findUserIdByEmail(EMAIL);

if (REMOVE) {
  // Rimozione pulita del cliente demo.
  await admin.from("clients").delete().eq("tenant_id", tenant.id).eq("email", EMAIL);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("🧹 Cliente demo rimosso.");
  process.exit(0);
}

if (userId) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) die("Update password utente fallito", error);
  console.log("• Utente auth riusato (password reimpostata).");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });
  if (error || !data?.user) die("Creazione utente auth fallita", error);
  userId = data.user.id;
  console.log("• Utente auth creato.");
}

// — Profilo 'client' nel tenant ————————————————————————————————————————————————
{
  const { error } = await admin.from("profiles").upsert(
    { id: userId, tenant_id: tenant.id, role: "client", full_name: FULL_NAME, email: EMAIL },
    { onConflict: "id" },
  );
  if (error) die("Upsert profilo fallito", error);
}

// — Cliente: cancella eventuale demo precedente (cascade sui figli) e ricrea ——
await admin.from("clients").delete().eq("tenant_id", tenant.id).eq("email", EMAIL);
const { data: client, error: cErr } = await admin
  .from("clients")
  .insert({
    tenant_id: tenant.id,
    profile_id: userId,
    coach_id: coachId,
    full_name: FULL_NAME,
    email: EMAIL,
    status: "active",
  })
  .select("id")
  .single();
if (cErr) die("Creazione cliente fallita", cErr);
const clientId = client.id;
console.log("• Cliente demo creato.");

// — Programma + versione pubblicata ———————————————————————————————————————————
const PROGRAM = {
  title: "Forza & Ipertrofia",
  summary: "Upper/Lower, 3 sedute a settimana. Focus forza nei fondamentali.",
  days: [
    {
      label: "Upper A",
      focus: "Petto e dorso",
      exercises: [
        { exercise_name: "Panca piana bilanciere", sets: 4, reps: "6-8", rest_seconds: 120, notes: "Scendi controllato, 2s in negativa." },
        { exercise_name: "Trazioni alla sbarra", sets: 4, reps: "max", rest_seconds: 120, notes: "" },
        { exercise_name: "Lento avanti manubri", sets: 3, reps: "8-10", rest_seconds: 90, notes: "" },
        { exercise_name: "Rematore manubrio", sets: 3, reps: "10-12", rest_seconds: 75, notes: "Una mano per volta." },
        { exercise_name: "Curl bilanciere", sets: 3, reps: "10-12", rest_seconds: 60, notes: "" },
        { exercise_name: "French press", sets: 3, reps: "10-12", rest_seconds: 60, notes: "" },
      ],
    },
    {
      label: "Lower A",
      focus: "Gambe e core",
      exercises: [
        { exercise_name: "Squat bilanciere", sets: 4, reps: "5-6", rest_seconds: 150, notes: "Profondità sotto il parallelo." },
        { exercise_name: "Stacco rumeno", sets: 3, reps: "8-10", rest_seconds: 120, notes: "" },
        { exercise_name: "Affondi in camminata", sets: 3, reps: "12 per gamba", rest_seconds: 90, notes: "" },
        { exercise_name: "Leg curl", sets: 3, reps: "12-15", rest_seconds: 60, notes: "" },
        { exercise_name: "Plank", sets: 3, reps: "45s", rest_seconds: 45, notes: "Glutei contratti." },
      ],
    },
    {
      label: "Upper B",
      focus: "Spalle e braccia",
      exercises: [
        { exercise_name: "Military press", sets: 4, reps: "6-8", rest_seconds: 120, notes: "" },
        { exercise_name: "Panca inclinata manubri", sets: 3, reps: "8-10", rest_seconds: 90, notes: "" },
        { exercise_name: "Lat machine", sets: 3, reps: "10-12", rest_seconds: 75, notes: "" },
        { exercise_name: "Alzate laterali", sets: 4, reps: "12-15", rest_seconds: 45, notes: "Niente slancio." },
        { exercise_name: "Curl a martello", sets: 3, reps: "10-12", rest_seconds: 60, notes: "" },
        { exercise_name: "Push down ai cavi", sets: 3, reps: "12-15", rest_seconds: 60, notes: "" },
      ],
    },
  ],
};

const { data: program, error: pErr } = await admin
  .from("programs")
  .insert({ tenant_id: tenant.id, client_id: clientId, title: PROGRAM.title, description: PROGRAM.summary })
  .select("id")
  .single();
if (pErr) die("Creazione programma fallita", pErr);

const nowIso = new Date().toISOString();
const { data: version, error: vErr } = await admin
  .from("program_versions")
  .insert({
    tenant_id: tenant.id,
    program_id: program.id,
    client_id: clientId,
    version: 1,
    status: "published",
    content: PROGRAM,
    generated_by_ai: false,
    created_by: coachId,
    published_at: nowIso,
  })
  .select("id")
  .single();
if (vErr) die("Creazione versione programma fallita", vErr);

await admin.from("programs").update({ current_version_id: version.id }).eq("id", program.id);
console.log("• Scheda pubblicata (3 giorni).");

// — Piano alimentare pubblicato ———————————————————————————————————————————————
const NUTRITION = {
  title: "Ricomposizione · 2300 kcal",
  summary: "Leggero surplus nei giorni di allenamento, proteine alte.",
  daily_calories: 2300,
  protein_g: 180,
  carbs_g: 240,
  fat_g: 70,
  meals: [
    { name: "Colazione", items: [{ food: "Fiocchi d'avena", quantity: "80 g" }, { food: "Albumi", quantity: "200 g" }, { food: "Banana", quantity: "1" }, { food: "Burro d'arachidi", quantity: "15 g" }], notes: "Ottima prima dell'allenamento." },
    { name: "Pranzo", items: [{ food: "Riso basmati", quantity: "100 g" }, { food: "Petto di pollo", quantity: "200 g" }, { food: "Verdure miste", quantity: "a volontà" }, { food: "Olio EVO", quantity: "10 g" }], notes: "" },
    { name: "Spuntino", items: [{ food: "Yogurt greco 0%", quantity: "170 g" }, { food: "Mirtilli", quantity: "100 g" }, { food: "Mandorle", quantity: "20 g" }], notes: "" },
    { name: "Cena", items: [{ food: "Patate", quantity: "200 g" }, { food: "Salmone", quantity: "180 g" }, { food: "Insalata", quantity: "a volontà" }, { food: "Olio EVO", quantity: "10 g" }], notes: "Salmone 2 volte a settimana per gli omega-3." },
  ],
};
{
  const { error } = await admin.from("nutrition_plans").insert({
    tenant_id: tenant.id,
    client_id: clientId,
    title: NUTRITION.title,
    status: "published",
    content: NUTRITION,
    generated_by_ai: false,
    created_by: coachId,
    published_at: nowIso,
  });
  if (error) die("Creazione piano alimentare fallita", error);
}
console.log("• Piano alimentare pubblicato.");

// — Allenamenti completati questa settimana (anello + week-strip ✓) ————————————
const now = new Date();
const startOfToday = new Date(now);
startOfToday.setHours(0, 0, 0, 0);
const mondayOffset = (now.getDay() + 6) % 7;
const monday = new Date(startOfToday);
monday.setDate(startOfToday.getDate() - mondayOffset);

// Giorni passati di questa settimana (lun..oggi) in cui mettere un completato.
const completedDates = [];
for (let i = 0; i <= mondayOffset && completedDates.length < 2; i++) {
  const d = new Date(monday);
  d.setDate(monday.getDate() + i);
  d.setHours(18, 0, 0, 0);
  if (d.getTime() <= now.getTime()) completedDates.push(d);
}
// Se oggi è lunedì (nessun giorno passato), segna un completato qualche ora fa.
if (completedDates.length === 0) {
  const d = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  completedDates.push(d);
}

const labels = PROGRAM.days.map((d) => d.label);
for (let i = 0; i < completedDates.length; i++) {
  const dt = completedDates[i].toISOString();
  const { error } = await admin.from("sessions").insert({
    tenant_id: tenant.id,
    client_id: clientId,
    program_version_id: version.id,
    title: labels[i % labels.length],
    status: "completed",
    scheduled_for: dt,
    completed_at: dt,
  });
  if (error) die("Creazione sessione completata fallita", error);
}
console.log(`• ${completedDates.length} allenamenti completati questa settimana.`);

// — Check-in da rispondere ————————————————————————————————————————————————————
{
  const { error } = await admin.from("checkins").insert({
    tenant_id: tenant.id,
    client_id: clientId,
    scheduled_for: nowIso,
    prompt: "Come è andata la settimana? Raccontami energia, sonno, fame e eventuali dolori.",
    status: "scheduled",
  });
  if (error) die("Creazione check-in fallita", error);
}
console.log("• Check-in da rispondere creato.");

// — Messaggio del coach ———————————————————————————————————————————————————————
if (coachId) {
  const { error } = await admin.from("messages").insert({
    tenant_id: tenant.id,
    client_id: clientId,
    sender_id: coachId,
    body: "Ciao Marco! Ho pubblicato la tua nuova scheda e il piano. Fammi sapere come va il primo Upper A 💪",
  });
  if (error) console.warn("⚠️ Messaggio coach non creato:", error.message);
  else console.log("• Messaggio del coach aggiunto.");
}

// — Riepilogo —————————————————————————————————————————————————————————————————
console.log("\n✅ Cliente demo pronto. Accedi con:");
console.log("   Email:    " + EMAIL);
console.log("   Password: " + PASSWORD);
console.log("\n   Sul computer:  http://localhost:3000");
console.log("   Sul telefono:  http://<IP-del-Mac>:3000  (stessa WiFi)\n");
