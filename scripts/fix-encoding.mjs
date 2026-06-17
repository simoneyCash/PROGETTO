// =============================================================================
// Coach AI — Riparazione "mojibake" degli accenti già salvati nel database.
//
// Alcune schede AI sono state salvate con gli accenti corrotti: "à" è diventato
// "√†", "è" è diventato "√®", ecc. (la risposta UTF-8 dell'AI è stata riletta
// come Mac Roman). Questo script rilegge le righe interessate e le rimette a
// posto, SENZA rigenerare la scheda (così resta il contenuto già approvato).
//
// USO:
//   1) Prova a vuoto (non scrive niente, ti dice solo cosa cambierebbe):
//        node --env-file=.env.local scripts/fix-encoding.mjs --dry
//   2) Riparazione vera:
//        node --env-file=.env.local scripts/fix-encoding.mjs
//
// È SICURO da rilanciare più volte: una riga già pulita viene lasciata stare.
// Usa la SUPABASE_SERVICE_ROLE_KEY (solo lato server, mai nel browser).
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error(
    "Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Lancia con:  node --env-file=.env.local scripts/fix-encoding.mjs",
  );
  process.exit(1);
}
const DRY = process.argv.includes("--dry");

// --- Stessa logica della Edge Function: inverte il mojibake Mac Roman --------
const MAC_DECODER = new TextDecoder("x-mac-roman");
const UNICODE_TO_MAC = new Map();
for (let b = 0; b < 256; b++) {
  UNICODE_TO_MAC.set(MAC_DECODER.decode(new Uint8Array([b])), b);
}
const UTF8_STRICT = new TextDecoder("utf-8", { fatal: true });

function repairText(s) {
  if (typeof s !== "string") return s;
  if (!s.includes("√") && !s.includes("¬")) return s; // "√" (byte C3) o "¬" (byte C2)
  const bytes = new Uint8Array(s.length * 2);
  let n = 0;
  for (const ch of s) {
    const b = UNICODE_TO_MAC.get(ch);
    if (b === undefined) return s;
    bytes[n++] = b;
  }
  try {
    return UTF8_STRICT.decode(bytes.subarray(0, n));
  } catch {
    return s;
  }
}

function repairDeep(v) {
  if (typeof v === "string") return repairText(v);
  if (Array.isArray(v)) return v.map(repairDeep);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v)) out[k] = repairDeep(v[k]);
    return out;
  }
  return v;
}

const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
let fixed = 0;

// 1) program_versions.content (le schede AI) ---------------------------------
{
  const { data, error } = await db.from("program_versions").select("id, content");
  if (error) throw error;
  for (const row of data ?? []) {
    const content = repairDeep(row.content);
    if (changed(content, row.content)) {
      console.log(`program_versions ${row.id} — da riparare`);
      if (!DRY) {
        const { error: e } = await db.from("program_versions").update({ content }).eq("id", row.id);
        if (e) throw e;
      }
      fixed++;
    }
  }
}

// 2) programs.title / description --------------------------------------------
{
  const { data, error } = await db.from("programs").select("id, title, description");
  if (error) throw error;
  for (const row of data ?? []) {
    const title = repairText(row.title ?? "");
    const description = repairText(row.description ?? "");
    if (title !== (row.title ?? "") || description !== (row.description ?? "")) {
      console.log(`programs ${row.id} — da riparare`);
      if (!DRY) {
        const { error: e } = await db.from("programs").update({ title, description }).eq("id", row.id);
        if (e) throw e;
      }
      fixed++;
    }
  }
}

// 3) nutrition_plans.content (best effort: la tabella/colonna potrebbe variare)
try {
  const { data, error } = await db.from("nutrition_plans").select("id, content");
  if (error) throw error;
  for (const row of data ?? []) {
    const content = repairDeep(row.content);
    if (changed(content, row.content)) {
      console.log(`nutrition_plans ${row.id} — da riparare`);
      if (!DRY) {
        const { error: e } = await db.from("nutrition_plans").update({ content }).eq("id", row.id);
        if (e) throw e;
      }
      fixed++;
    }
  }
} catch (e) {
  console.warn(`nutrition_plans saltato (${e.message})`);
}

console.log(
  DRY
    ? `\n[PROVA A VUOTO] Righe che verrebbero riparate: ${fixed}. Rilancia senza --dry per applicare.`
    : `\nFatto ✅  Righe riparate: ${fixed}.`,
);
