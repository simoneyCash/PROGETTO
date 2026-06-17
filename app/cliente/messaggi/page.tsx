import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { sendClientMessage } from "./actions";

type Message = {
  id: string;
  sender_role: string | null;
  body: string;
  created_at: string;
};

function formatTime(value: string): string {
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ClientMessages({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  const { error } = await searchParams;

  const supabase = await createClient();
  // La RLS limita già i messaggi a quelli del cliente corrente.
  const { data: messagesData } = await supabase
    .from("messages")
    .select("id, sender_role, body, created_at")
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as Message[];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/cliente"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ La tua scheda
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">Messaggi</h1>
        <p className="text-sm text-neutral-500">Con il tuo coach</p>
      </header>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Thread */}
      <section className="mt-6 flex flex-1 flex-col gap-3">
        {messages.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
            Nessun messaggio. Scrivi il primo qui sotto.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_role === "client";
          return (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                mine
                  ? "self-end bg-emerald-600/20 text-emerald-50"
                  : "self-start bg-neutral-800 text-neutral-100"
              }`}
            >
              {!mine && (
                <p className="mb-0.5 text-[10px] font-medium text-neutral-400">
                  Coach
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              <p className="mt-1 text-[10px] text-neutral-400">
                {formatTime(m.created_at)}
              </p>
            </div>
          );
        })}
      </section>

      {/* Composer */}
      <form action={sendClientMessage} className="mt-4 flex gap-2">
        <input
          name="body"
          required
          autoComplete="off"
          placeholder="Scrivi al coach…"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500"
        >
          Invia
        </button>
      </form>
    </main>
  );
}
