import { Dumbbell } from "@/components/ui/icons";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActivationForm } from "@/components/ActivationForm";

// Pagina PUBBLICA (nessun login): il cliente attiva il proprio account dal link
// generato dal coach. Il token è risolto SOLO lato server con la chiave di
// servizio. force-dynamic: dipende dal token.
export const dynamic = "force-dynamic";

export default async function ActivatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, full_name, access_token_expires_at")
    .eq("access_token", token)
    .maybeSingle();

  const expired =
    !!client?.access_token_expires_at &&
    new Date(client.access_token_expires_at) < new Date();

  if (!client || expired) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-6 text-center">
        <h1 className="text-2xl font-medium tracking-tight">
          Link non valido
        </h1>
        <p className="mt-2 text-sm text-muted">
          Questo link di accesso non è più attivo. Chiedi al tuo coach di
          inviartene uno nuovo.
        </p>
      </main>
    );
  }

  const firstName = client.full_name.split(" ")[0] || client.full_name;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <header className="mb-7">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-fg">
            <Dumbbell className="size-5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Coach AI
          </span>
        </div>
        <h1 className="mt-6 text-3xl font-medium tracking-tight">
          Benvenuto, {firstName} 👋
        </h1>
        <p className="mt-2 text-sm text-muted">
          Scegli una password per accedere alla tua app: scheda, allenamenti,
          piano alimentare e messaggi con il coach.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      <ActivationForm token={token} />
    </main>
  );
}
