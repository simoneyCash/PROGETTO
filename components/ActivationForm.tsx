"use client";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { btn, field } from "@/components/ui/kit";
import { activateAccount } from "@/app/attiva/[token]/actions";

// Form pubblico: il cliente sceglie la password per attivare il suo account.
// La logica (creazione account + profilo + collegamento + login) è tutta nella
// server action activateAccount: qui raccogliamo solo password + conferma.
export function ActivationForm({ token }: { token: string }) {
  return (
    <form action={activateAccount} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-foreground">Scegli una password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Almeno 8 caratteri"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-foreground">Ripeti la password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={field}
        />
      </label>

      <SubmitButton className={btn.primary} pendingText="Attivazione…">
        Attiva il mio accesso
      </SubmitButton>
    </form>
  );
}
