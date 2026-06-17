import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { sendMessage } from "../actions";

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

export default async function CoachThread({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { profile } = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!isStaff(profile.role)) redirect("/cliente");

  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  const { data: messagesData } = await supabase
    .from("messages")
    .select("id, sender_role, body, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as Message[];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <Link
        href="/coach/messaggi"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ‹ Conversazioni
      </Link>

      <header className="mt-4">
        <h1 className="text-xl font-semibold">{client.full_name}</h1>
      </header>

      {/* Thread */}
      <section className="mt-6 flex flex-1 flex-col gap-3">
        {messages.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-sm text-neutral-500">
            Nessun messaggio. Scrivi il primo qui sotto.
          </p>
        )}
        {messages.map((m) => {
          const fromStaff = m.sender_role === "coach" || m.sender_role === "admin";
          return (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                fromStaff
                  ? "self-end bg-emerald-600/20 text-emerald-50"
                  : "self-start bg-neutral-800 text-neutral-100"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              <p className="mt-1 text-[10px] text-neutral-400">
                {formatTime(m.created_at)}
              </p>
            </div>
          );
        })}
      </section>

      {/* Composer */}
      <form action={sendMessage} className="mt-4 flex gap-2">
        <input type="hidden" name="client_id" value={client.id} />
        <input
          name="body"
          required
          autoComplete="off"
          placeholder="Scrivi un messaggio…"
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
