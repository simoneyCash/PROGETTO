"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Pulsante di submit con protezione anti doppio-invio: durante l'esecuzione
// della server action del <form> genitore si disabilita (useFormStatus) ed
// espone aria-busy. Accetta className (es. btn.primary del kit) e gli altri
// attributi nativi (name/value per i form con più azioni). pendingText: testo
// opzionale mostrato durante l'invio.
export function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
  ...props
}: {
  children: ReactNode;
  pendingText?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={className}
      {...props}
    >
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
