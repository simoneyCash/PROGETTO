import { Dumbbell } from "@/components/ui/icons";
import { login } from "./actions";
import { field, btn } from "@/components/ui/kit";
import { SubmitButton } from "@/components/ui/SubmitButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col justify-center p-6">
      <div className="mx-auto w-full max-w-sm">
        {/* Marchio */}
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <Dumbbell className="size-5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">Coach AI</span>
        </div>

        <div className="mt-12">
          <h1 className="font-serif text-4xl font-medium tracking-tight">
            Bentornato.
          </h1>
          <p className="mt-2 text-[15px] text-white/55">
            Accedi per continuare ad allenare i tuoi clienti.
          </p>
        </div>

        <form action={login} className="mt-8 flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-white/80">Email</span>
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
            <span className="font-medium text-white/80">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className={field}
            />
          </label>

          <SubmitButton className={`${btn.primary} mt-2 w-full`} pendingText="Accesso…">
            Accedi
          </SubmitButton>
        </form>

        <p className="mt-8 text-center text-xs text-white/40">
          L&apos;AI prepara, tu approvi. Sempre in controllo.
        </p>
      </div>
    </main>
  );
}
