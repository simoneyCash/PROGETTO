import { Dumbbell } from "@/components/ui/icons";
import { login } from "./actions";
import { field, btn } from "@/components/ui/kit";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Reveal } from "@/components/ui/motion";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden p-6">
      {/* Aurora ambientale verde che deriva dietro al contenuto */}
      <div className="aurora" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-sm">
        {/* Marchio */}
        <Reveal delay={0.05}>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-[0_8px_24px_-6px_var(--accent-glow)]">
              <Dumbbell className="size-5" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight">Coach AI</span>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="mt-12">
          <h1 className="text-4xl font-semibold tracking-tight">Bentornato.</h1>
          <p className="mt-2 text-[15px] text-muted">
            Accedi per continuare ad allenare i tuoi clienti.
          </p>
        </Reveal>

        <Reveal delay={0.19} className="mt-8">
          <form action={login} className="flex flex-col gap-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error"
              >
                {error}
              </p>
            )}

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-muted">Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@esempio.com"
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-muted">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className={field}
              />
            </label>

            <SubmitButton
              className={`${btn.primary} mt-2 w-full`}
              pendingText="Accesso…"
            >
              Accedi
            </SubmitButton>
          </form>
        </Reveal>

        <Reveal delay={0.28} className="mt-8">
          <p className="text-center text-xs text-faint">
            L&apos;AI prepara, tu approvi. Sempre in controllo.
          </p>
        </Reveal>
      </div>
    </main>
  );
}
