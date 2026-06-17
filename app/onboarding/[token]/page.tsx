import { Dumbbell } from "@/components/ui/icons";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnamnesisWizard } from "@/components/AnamnesisWizard";

// Pagina PUBBLICA (nessun login): un lead compila l'anamnesi via link/token.
// Il token è risolto SOLO lato server con la chiave di servizio (la tabella
// clients non è leggibile dal browser). force-dynamic: dipende dal token.
export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, full_name, intake_token_expires_at")
    .eq("intake_token", token)
    .maybeSingle();

  const expired =
    !!client?.intake_token_expires_at &&
    new Date(client.intake_token_expires_at) < new Date();

  if (!client || expired) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-6 text-center">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Link non valido
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Questo link non è più attivo. Chiedi al tuo coach di inviartene uno
          nuovo.
        </p>
      </main>
    );
  }

  const { data: existing } = await admin
    .from("intakes")
    .select("submitted_at")
    .eq("client_id", client.id)
    .not("submitted_at", "is", null)
    .limit(1)
    .maybeSingle();
  const alreadyDone = !!existing?.submitted_at;

  const firstName = client.full_name.split(" ")[0] || client.full_name;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <header className="mb-7">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <Dumbbell className="size-5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Coach AI
          </span>
        </div>
        <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight">
          Ciao {firstName} 👋
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Rispondi a qualche domanda: aiuteranno il tuo coach a costruire il
          programma su misura per te.
        </p>
      </header>

      {alreadyDone ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
          <h2 className="text-lg font-semibold tracking-tight">
            Già inviato ✅
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Hai già compilato il questionario. Il tuo coach sta lavorando al tuo
            programma.
          </p>
        </div>
      ) : (
        <AnamnesisWizard token={token} clientName={client.full_name} />
      )}
    </main>
  );
}
