import { redirect } from "next/navigation";
import { getCurrentProfile, isStaff } from "@/lib/supabase/profile";
import { LogoutButton } from "@/components/LogoutButton";

// Dispatcher: smista per ruolo. Il middleware garantisce che qui si arrivi
// solo da autenticati.
export default async function Home() {
  const { profile } = await getCurrentProfile();

  if (profile) {
    redirect(isStaff(profile.role) ? "/coach" : "/cliente");
  }

  // Account auth esistente ma non ancora collegato a un tenant/coach.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Account non ancora configurato</h1>
      <p className="max-w-sm text-sm text-neutral-400">
        Il tuo accesso è valido, ma l&apos;account non è ancora collegato a un
        coach. Contatta l&apos;amministratore per il completamento.
      </p>
      <LogoutButton />
    </main>
  );
}
