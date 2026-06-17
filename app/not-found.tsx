import Link from "next/link";

// Pagina 404 brandizzata.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-semibold tracking-tight text-accent">404</p>
      <h1 className="text-xl font-semibold tracking-tight">Pagina non trovata</h1>
      <p className="text-sm text-neutral-400">
        La pagina che cerchi non esiste o è stata spostata.
      </p>
      <Link
        href="/"
        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-[#f0cd86]"
      >
        Torna alla home
      </Link>
    </main>
  );
}
