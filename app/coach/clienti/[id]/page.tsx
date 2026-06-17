import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import {
  saveIntake,
  generateProgramDraft,
  createIntakeLink,
} from "../../actions";
import { GenerateButton } from "@/components/GenerateButton";
import { ArtifactBadge, CheckinBadge } from "@/components/ui/StatusBadge";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import {
  Page,
  BackLink,
  Card,
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";
import { SubmitButton } from "@/components/ui/SubmitButton";

type ProgramVersion = {
  id: string;
  version: number;
  status: string;
  created_at: string;
};

type CheckinRow = {
  id: string;
  prompt: string | null;
  status: string;
  scheduled_for: string | null;
  created_at: string;
};

// L'anamnesi compilata via link è ricca (schema_version 2, a sezioni); quella
// inserita a mano dal coach ha solo i campi piatti. Il tipo copre entrambe.
type Section = { birth_date?: string; sex?: string; height_cm?: string; weight_kg?: string };
type IntakeAnswers = {
  schema_version?: number;
  anagrafica?: Section;
  obiettivi?: { goal?: string; motivation?: string };
  allenamento?: { experience?: string; days_per_week?: string; equipment?: string };
  salute?: { injuries?: string; conditions?: string; medications?: string };
  nutrizione?: { diet?: string; allergies?: string };
  stile_vita?: { sleep_hours?: string };
  // campi piatti (retro-compatibilità + editor manuale)
  goal?: string;
  experience?: string;
  days_per_week?: string;
  equipment?: string;
  injuries?: string;
  notes?: string;
};

const CLIENT_STATUS: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-sky-500/15 text-sky-300" },
  active: { label: "Attivo", className: "bg-emerald-500/15 text-emerald-300" },
  paused: { label: "In pausa", className: "bg-amber-500/15 text-amber-300" },
  churned: { label: "Perso", className: "bg-neutral-700/40 text-neutral-400" },
};

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// Età dalla data di nascita (server-safe). Stringa vuota se assente/non valida.
function ageFrom(birth?: string): string {
  if (!birth) return "";
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 130) return "";
  return `${age} anni`;
}

function formatDate(value: string | null): string {
  if (!value) return "Senza data";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Scheda informativa: mostra solo le righe con un valore. Se nessuna -> niente.
function InfoCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value?: string }[];
}) {
  const visible = rows.filter((r) => r.value && r.value.trim());
  if (visible.length === 0) return null;
  return (
    <Card>
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </h3>
      <dl className="mt-3 flex flex-col gap-3">
        {visible.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-neutral-500">{r.label}</dt>
            <dd className="whitespace-pre-wrap text-sm text-neutral-200">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    error?: string;
    invite?: string;
    tab?: string;
  }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { saved, error, invite, tab } = await searchParams;

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, email, status, intake_token, intake_token_expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const { data: intake } = await supabase
    .from("intakes")
    .select("answers, submitted_at")
    .eq("client_id", id)
    .limit(1)
    .maybeSingle();

  const a = (intake?.answers ?? {}) as IntakeAnswers;

  const { data: versionsData } = await supabase
    .from("program_versions")
    .select("id, version, status, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });
  const versions = (versionsData ?? []) as ProgramVersion[];

  const { data: checkinsData } = await supabase
    .from("checkins")
    .select("id, prompt, status, scheduled_for, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });
  const checkins = (checkinsData ?? []) as CheckinRow[];

  const hasIntake = !!intake?.submitted_at;
  const inviteValid =
    !!client.intake_token &&
    (!client.intake_token_expires_at ||
      new Date(client.intake_token_expires_at) > new Date());

  // Valori unificati (sezione ricca se presente, altrimenti campo piatto).
  const ana = a.anagrafica ?? {};
  const obj = a.obiettivi ?? {};
  const all = a.allenamento ?? {};
  const sal = a.salute ?? {};
  const nut = a.nutrizione ?? {};
  const stl = a.stile_vita ?? {};
  const isRich = a.schema_version === 2 || !!a.anagrafica;

  const uGoal = cap(obj.goal || a.goal);
  const uExp = cap(all.experience || a.experience);
  const uDays = all.days_per_week || a.days_per_week;
  const uAge = ageFrom(ana.birth_date);
  const uWeight = ana.weight_kg ? `${ana.weight_kg} kg` : "";

  const status = CLIENT_STATUS[client.status] ?? {
    label: client.status,
    className: "bg-neutral-700/40 text-neutral-400",
  };

  // Tab iniziale: dal parametro ?tab, altrimenti "quadro".
  const defaultTab = ["quadro", "anamnesi", "scheda", "checkin"].includes(
    tab ?? "",
  )
    ? (tab as string)
    : "quadro";

  // ---- Contenuto delle linguette -------------------------------------------

  const quadro = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Anamnesi", value: hasIntake ? "✓" : "—" },
          {
            label: "Scheda",
            value: versions.length ? `v${versions[0].version}` : "—",
          },
          { label: "Check-in", value: String(checkins.length) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-3"
          >
            <div className="text-lg font-semibold">{s.value}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{s.label}</div>
          </div>
        ))}
      </div>

      <InfoCard
        title="In sintesi"
        rows={[
          { label: "Obiettivo", value: uGoal },
          { label: "Esperienza", value: uExp },
          { label: "Giorni a settimana", value: uDays },
          { label: "Età", value: uAge },
          { label: "Peso iniziale", value: uWeight },
          { label: "Ore di sonno", value: stl.sleep_hours },
        ]}
      />

      {!hasIntake && (
        <EmptyState>
          Anamnesi non ancora compilata. Manda il link al cliente dalla linguetta{" "}
          <span className="text-neutral-300">Anamnesi</span>.
        </EmptyState>
      )}
    </div>
  );

  const anamnesi = (
    <div className="flex flex-col gap-6">
      {/* Invito anamnesi (il cliente compila dal telefono) */}
      <Card>
        <h2 className="text-sm font-medium text-neutral-200">
          Invito al cliente
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Manda un link: compila lui il questionario dal telefono e i dati
          riempiono questa scheda.
        </p>
        {inviteValid ? (
          <div className="mt-3 flex flex-col gap-2">
            <CopyLinkButton path={`/onboarding/${client.intake_token}`} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">Link attivo</span>
              <form action={createIntakeLink}>
                <input type="hidden" name="client_id" value={client.id} />
                <SubmitButton
                  className="text-xs text-neutral-400 transition-colors hover:text-neutral-200"
                  pendingText="Genero…"
                >
                  Rigenera
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : (
          <form action={createIntakeLink} className="mt-3">
            <input type="hidden" name="client_id" value={client.id} />
            <SubmitButton className={btn.secondary} pendingText="Genero…">
              Genera link anamnesi
            </SubmitButton>
          </form>
        )}
      </Card>

      {/* Vista ricca: sezioni dell'anamnesi compilata */}
      {hasIntake ? (
        isRich ? (
          <div className="flex flex-col gap-3">
            <InfoCard
              title="Anagrafica"
              rows={[
                { label: "Età", value: uAge },
                { label: "Sesso", value: ana.sex },
                {
                  label: "Altezza",
                  value: ana.height_cm ? `${ana.height_cm} cm` : "",
                },
                {
                  label: "Peso iniziale",
                  value: ana.weight_kg ? `${ana.weight_kg} kg` : "",
                },
              ]}
            />
            <InfoCard
              title="Obiettivi"
              rows={[
                { label: "Obiettivo", value: cap(obj.goal) },
                { label: "Motivazione", value: obj.motivation },
              ]}
            />
            <InfoCard
              title="Allenamento"
              rows={[
                { label: "Esperienza", value: cap(all.experience) },
                { label: "Giorni a settimana", value: all.days_per_week },
                { label: "Attrezzatura", value: all.equipment },
              ]}
            />
            <InfoCard
              title="Salute"
              rows={[
                { label: "Infortuni / dolori", value: sal.injuries },
                { label: "Patologie / condizioni", value: sal.conditions },
                { label: "Farmaci", value: sal.medications },
              ]}
            />
            <InfoCard
              title="Nutrizione"
              rows={[
                { label: "Abitudini alimentari", value: nut.diet },
                { label: "Allergie / intolleranze", value: nut.allergies },
              ]}
            />
            <InfoCard
              title="Stile di vita"
              rows={[
                { label: "Ore di sonno", value: stl.sleep_hours },
                { label: "Note per il coach", value: a.notes },
              ]}
            />
          </div>
        ) : (
          // Anamnesi inserita a mano (solo campi piatti).
          <InfoCard
            title="Riepilogo"
            rows={[
              { label: "Obiettivo", value: cap(a.goal) },
              { label: "Esperienza", value: cap(a.experience) },
              { label: "Giorni a settimana", value: a.days_per_week },
              { label: "Attrezzatura", value: a.equipment },
              { label: "Infortuni / limitazioni", value: a.injuries },
              { label: "Note", value: a.notes },
            ]}
          />
        )
      ) : (
        <EmptyState>
          Nessuna risposta ancora. Invia il link qui sopra, oppure inseriscila a
          mano qui sotto.
        </EmptyState>
      )}

      {/* Editor manuale (secondario): per i clienti che non compilano il link */}
      <details className="rounded-2xl border border-white/10 bg-white/[0.02] [&_summary]:cursor-pointer">
        <summary className="px-4 py-3 text-sm font-medium text-neutral-200">
          Inserisci / modifica a mano
        </summary>
        <div className="border-t border-white/10 p-4">
          <p className="text-xs text-neutral-500">
            Queste risposte servono all&apos;AI per generare la bozza di scheda.
          </p>
          <form action={saveIntake} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="client_id" value={client.id} />

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Obiettivo</span>
              <select name="goal" defaultValue={a.goal ?? ""} className={field}>
                <option value="">—</option>
                <option value="dimagrimento">Dimagrimento</option>
                <option value="ipertrofia">Ipertrofia</option>
                <option value="forza">Forza</option>
                <option value="ricomposizione">Ricomposizione</option>
                <option value="salute">Salute generale</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Esperienza</span>
              <select
                name="experience"
                defaultValue={a.experience ?? ""}
                className={field}
              >
                <option value="">—</option>
                <option value="principiante">Principiante</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzato">Avanzato</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Giorni a settimana</span>
              <select
                name="days_per_week"
                defaultValue={a.days_per_week ?? ""}
                className={field}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Attrezzatura disponibile</span>
              <input
                name="equipment"
                defaultValue={a.equipment ?? ""}
                placeholder="Es. palestra completa, casa con manubri…"
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Infortuni / limitazioni</span>
              <textarea
                name="injuries"
                defaultValue={a.injuries ?? ""}
                rows={2}
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Note</span>
              <textarea
                name="notes"
                defaultValue={a.notes ?? ""}
                rows={2}
                className={field}
              />
            </label>

            <SubmitButton className={btn.primary} pendingText="Salvataggio…">
              Salva intake
            </SubmitButton>
          </form>
        </div>
      </details>
    </div>
  );

  const scheda = (
    <div>
      <form action={generateProgramDraft}>
        <input type="hidden" name="client_id" value={client.id} />
        <GenerateButton disabled={!hasIntake} />
        {!hasIntake && (
          <p className="mt-2 text-xs text-neutral-500">
            Salva prima l&apos;intake per poter generare la scheda.
          </p>
        )}
      </form>

      {versions.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {versions.map((v) => (
            <li key={v.id}>
              <Card
                href={`/coach/programmi/${v.id}`}
                className="flex items-center justify-between"
              >
                <span className="text-sm">Versione {v.version}</span>
                <ArtifactBadge status={v.status} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <EmptyState>Nessuna scheda ancora.</EmptyState>
        </div>
      )}
    </div>
  );

  const checkin = (
    <div>
      <Link href="/coach/checkin" className={btn.secondary}>
        <Plus className="size-4" />
        Nuovo check-in
      </Link>

      {checkins.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {checkins.map((c) => (
            <li key={c.id}>
              <Card
                href={`/coach/checkin/${c.id}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-xs text-neutral-500">
                  {formatDate(c.scheduled_for)}
                </span>
                <CheckinBadge status={c.status} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <EmptyState>
            Nessun check-in ancora per questo cliente.
          </EmptyState>
        </div>
      )}
    </div>
  );

  const tabs: TabDef[] = [
    { key: "quadro", label: "Quadro", content: quadro },
    { key: "anamnesi", label: "Anamnesi", content: anamnesi },
    { key: "scheda", label: "Scheda", content: scheda },
    { key: "checkin", label: "Check-in", content: checkin },
  ];

  return (
    <Page className="gap-5">
      <BackLink href="/coach/clienti">Torna ai clienti</BackLink>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {client.full_name}
          </h1>
          {client.email && (
            <p className="truncate text-sm text-neutral-500">{client.email}</p>
          )}
        </div>
        <span
          className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </header>

      {/* Banner globali: visibili su qualunque linguetta */}
      {invite && (
        <Banner tone="success">
          Link anamnesi generato. Copialo e invialo al cliente.
        </Banner>
      )}
      {saved && <Banner tone="success">Intake salvato.</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <Tabs tabs={tabs} defaultTab={defaultTab} />
    </Page>
  );
}
