import { redirect } from "next/navigation";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ClientHome() {
  const { profile } = await getCurrentProfile();

  if (!profile) redirect("/");
  if (isStaff(profile.role)) redirect("/coach");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-400">
            Area Cliente
          </p>
          <h1 className="text-lg font-semibold">
            Ciao{profile.full_name ? `, ${profile.full_name}` : ""}
          </h1>
        </div>
        <LogoutButton />
      </header>

      <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <p className="text-sm text-neutral-300">
          Qui vedrai la tua scheda, gli allenamenti e i check-in — non appena il
          coach li avrà approvati.
        </p>
      </div>
    </main>
  );
}
