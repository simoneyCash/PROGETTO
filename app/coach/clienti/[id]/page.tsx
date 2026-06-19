import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Plus,
  Copy,
  CircleCheck,
  Dumbbell,
  ClipboardCheck,
  ChevronRight,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import {
  saveIntake,
  generateProgramDraft,
  createIntakeLink,
  createClientAccess,
} from "../../actions";
import { GenerateButton } from "@/components/GenerateButton";
import { ArtifactBadge, CheckinBadge } from "@/components/ui/StatusBadge";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import {
  Page,
  BackLink,
  Card,
  SectionLabel,
  Row,
  Stat,
  IconTile,
  Avatar,
  EmptyState,
  Banner,
  btn,
  field,
} from "@/components/ui/kit";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";

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
  churned: { label: "Perso", className: "bg-neutral-700/40 text-muted" },
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
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </h3>
      <dl className="mt-3 flex flex-col gap-3">
        {visible.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted">{r.label}</dt>
            <dd className="whitespace-pre-wrap text-sm text-foreground">
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
    invited?: string;
    access?: string;
    tab?: string;
  }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { id } = await params;
  const { saved, error, invite, invited, access, tab } = await searchParams;

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, full_name, email, status, profile_id, intake_token, intake_token_expires_at, access_token, access_token_expires_at",
    )
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

  // Accesso all'app: l'account è attivo quando profile_id è collegato.
  const hasAccount = !!client.profile_id;
  const accessValid =
    !!client.access_token &&
    (!client.access_token_expires_at ||
      new Date(client.access_token_expires_at) > new Date());

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
    className: "bg-neutral-700/40 text-muted",
  };

  // Tab iniziale: dal parametro ?tab, altrimenti "quadro".
  const defaultTab = ["quadro", "anamnesi", "scheda", "checkin"].includes(
    tab ?? "",
  )
    ? (tab as string)
    : "quadro";

  // ---- Contenuto delle linguette -------------------------------------------

  const quadro = (
    <div className="flex flex-col gap-6">
      {/* Sintesi (KPI) */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Anamnesi" value={hasIntake ? "✓" : "—"} />
        <Stat
          label="Scheda"
          value={versions.length ? `v${versions[0].version}` : "—"}
        />
        <Stat label="Check-in" value={<AnimatedNumber value={checkins.length} />} />
      </div>

      {/* Accesso all'app: crea l'account del cliente con un link, senza SQL */}
      <section>
        <SectionLabel>Accesso all&apos;app</SectionLabel>
        <Card className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <IconTile
              icon={hasAccount ? CircleCheck : Copy}
              tone={hasAccount ? "accent" : "muted"}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Accesso all&apos;app
              </p>
              {hasAccount ? (
                <p className="mt-0.5 text-xs text-muted">
                  Account attivo: il cliente accede con la sua email e password.
                </p>
              ) : accessValid ? (
                <p className="mt-0.5 text-xs text-muted">
                  Manda questo link al cliente: aprendolo sceglie la password ed
                  entra subito nell&apos;app.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted">
                  Crea un link: il cliente sceglie la password e accede
                  all&apos;app, senza creare nulla a mano.
                </p>
              )}
            </div>
          </div>

          {hasAccount ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-success">Account attivo ✓</span>
              <form action={createClientAccess}>
                <input type="hidden" name="client_id" value={client.id} />
                <SubmitButton
                  className="text-xs text-muted transition-colors hover:text-foreground"
                  pendingText="Genero…"
                >
                  Rigenera link (reset password)
                </SubmitButton>
              </form>
            </div>
          ) : accessValid ? (
            <div className="flex flex-col gap-2">
              <CopyLinkButton path={`/attiva/${client.access_token}`} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Link attivo · 7 giorni</span>
                <form action={createClientAccess}>
                  <input type="hidden" name="client_id" value={client.id} />
                  <SubmitButton
                    className="text-xs text-muted transition-colors hover:text-foreground"
                    pendingText="Genero…"
                  >
                    Rigenera
                  </SubmitButton>
                </form>
              </div>
            </div>
          ) : (
            <>
              <form action={createClientAccess}>
                <input type="hidden" name="client_id" value={client.id} />
                <SubmitButton className={btn.secondary} pendingText="Genero…">
                  Crea link di accesso
                </SubmitButton>
              </form>
              {!client.email && (
                <p className="text-xs text-warning">
                  Aggiungi prima l&apos;email del cliente per poter creare
                  l&apos;accesso.
                </p>
              )}
            </>
          )}
        </Card>
      </section>

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
        <EmptyState icon={ClipboardCheck}>
          Anamnesi non ancora compilata. Manda il link al cliente dalla linguetta{" "}
          <span className="text-foreground">Anamnesi</span>.
        </EmptyState>
      )}
    </div>
  );

  const anamnesi = (
    <div className="flex flex-col gap-6">
      {/* Invito anamnesi (il cliente compila dal telefono) */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <IconTile icon={ClipboardCheck} tone="muted" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Invito al cliente
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Manda un link: compila lui il questionario dal telefono e i dati
              riempiono questa scheda.
            </p>
          </div>
        </div>
        {inviteValid ? (
          <div className="flex flex-col gap-2">
            <CopyLinkButton path={`/onboarding/${client.intake_token}`} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Link attivo</span>
              <form action={createIntakeLink}>
                <input type="hidden" name="client_id" value={client.id} />
                <SubmitButton
                  className="text-xs text-muted transition-colors hover:text-foreground"
                  pendingText="Genero…"
                >
                  Rigenera
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : (
          <form action={createIntakeLink}>
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
        <EmptyState icon={ClipboardCheck}>
          Nessuna risposta ancora. Invia il link qui sopra, oppure inseriscila a
          mano qui sotto.
        </EmptyState>
      )}

      {/* Editor manuale (secondario): per i clienti che non compilano il link */}
      <details className="rounded-xl border border-border bg-surface-1 [&_summary]:cursor-pointer">
        <summary className="px-4 py-3 text-sm font-medium text-foreground">
          Inserisci / modifica a mano
        </summary>
        <div className="border-t border-border p-4">
          <p className="text-xs text-muted">
            Queste risposte servono all&apos;AI per generare la bozza di scheda.
          </p>
          <form action={saveIntake} className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="client_id" value={client.id} />

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">Obiettivo</span>
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
              <span className="text-muted">Esperienza</span>
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
              <span className="text-muted">Giorni a settimana</span>
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
              <span className="text-muted">Attrezzatura disponibile</span>
              <input
                name="equipment"
                defaultValue={a.equipment ?? ""}
                placeholder="Es. palestra completa, casa con manubri…"
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">Infortuni / limitazioni</span>
              <textarea
                name="injuries"
                defaultValue={a.injuries ?? ""}
                rows={2}
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">Note</span>
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
    <div className="flex flex-col gap-6">
      <form action={generateProgramDraft}>
        <input type="hidden" name="client_id" value={client.id} />
        <GenerateButton disabled={!hasIntake} />
        {!hasIntake && (
          <p className="mt-2 text-xs text-muted">
            Salva prima l&apos;intake per poter generare la scheda.
          </p>
        )}
      </form>

      {versions.length > 0 ? (
        <section>
          <SectionLabel>Versioni</SectionLabel>
          <div className="flex flex-col gap-2">
            {versions.map((v) => (
              <Row
                key={v.id}
                href={`/coach/programmi/${v.id}`}
                leading={<IconTile icon={Dumbbell} tone="muted" />}
                title={`Versione ${v.version}`}
                trailing={
                  <>
                    <ArtifactBadge status={v.status} />
                    <ChevronRight className="size-4" />
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState icon={Dumbbell}>Nessuna scheda ancora.</EmptyState>
      )}
    </div>
  );

  const checkin = (
    <div className="flex flex-col gap-6">
      <Link href="/coach/checkin" className={btn.secondary}>
        <Plus className="size-5" />
        Nuovo check-in
      </Link>

      {checkins.length > 0 ? (
        <section>
          <SectionLabel>Cronologia</SectionLabel>
          <div className="flex flex-col gap-2">
            {checkins.map((c) => (
              <Row
                key={c.id}
                href={`/coach/checkin/${c.id}`}
                leading={<IconTile icon={ClipboardCheck} tone="muted" />}
                title={formatDate(c.scheduled_for)}
                trailing={
                  <>
                    <CheckinBadge status={c.status} />
                    <ChevronRight className="size-4" />
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState icon={ClipboardCheck}>
          Nessun check-in ancora per questo cliente.
        </EmptyState>
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
      <Stagger className="flex flex-col gap-5">
        <StaggerItem>
          <BackLink href="/coach/clienti">Torna ai clienti</BackLink>
        </StaggerItem>

        <StaggerItem>
          <header className="flex items-start gap-3">
            <Avatar name={client.full_name} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {client.full_name}
              </h1>
              {client.email && (
                <p className="truncate text-sm text-muted">{client.email}</p>
              )}
            </div>
            <span
              className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </header>
        </StaggerItem>

        {/* Banner globali: visibili su qualunque linguetta */}
        {invited === "sent" && (
          <StaggerItem>
            <Banner tone="success">
              Email di invito inviata a {client.email}. Quando completa accesso e
              questionario, troverai qui i suoi dati.
            </Banner>
          </StaggerItem>
        )}
        {invited === "link" && (
          <StaggerItem>
            <Banner tone="info">
              Cliente creato. L&apos;email automatica non è ancora attiva (serve
              Resend): invia tu il link dalla sezione &quot;Invito al
              cliente&quot; qui sotto.
            </Banner>
          </StaggerItem>
        )}
        {invite && (
          <StaggerItem>
            <Banner tone="success">
              Link anamnesi generato. Copialo e invialo al cliente.
            </Banner>
          </StaggerItem>
        )}
        {access === "sent" && (
          <StaggerItem>
            <Banner tone="success">
              Email di accesso inviata al cliente. Può aprirla, scegliere la
              password ed entrare nell&apos;app.
            </Banner>
          </StaggerItem>
        )}
        {access === "1" && (
          <StaggerItem>
            <Banner tone="success">
              Link di accesso creato. Copialo e invialo al cliente: aprendolo
              sceglie la password ed entra nell&apos;app.
            </Banner>
          </StaggerItem>
        )}
        {saved && (
          <StaggerItem>
            <Banner tone="success">Intake salvato.</Banner>
          </StaggerItem>
        )}
        {error && (
          <StaggerItem>
            <Banner tone="error">{error}</Banner>
          </StaggerItem>
        )}

        <StaggerItem>
          <Tabs tabs={tabs} defaultTab={defaultTab} />
        </StaggerItem>
      </Stagger>
    </Page>
  );
}
