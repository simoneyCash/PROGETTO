import Link from "next/link";
import { btn } from "@/components/ui/kit";

// Pagina 404 brandizzata.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-semibold tracking-tight text-foreground">404</p>
      <h1 className="text-xl font-semibold tracking-tight">Pagina non trovata</h1>
      <p className="text-sm text-muted">
        La pagina che cerchi non esiste o è stata spostata.
      </p>
      <Link href="/" className={btn.primary}>
        Torna alla home
      </Link>
    </main>
  );
}
