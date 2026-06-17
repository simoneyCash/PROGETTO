import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Coach AI</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Accedi al tuo account per continuare
          </p>
        </div>

        <form action={login} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-300">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700"
          >
            Accedi
          </button>
        </form>
      </div>
    </main>
  );
}
