// =============================================================================
// Template email transazionali (HTML inline, compatibile con i client di posta).
// Niente CSS esterno né classi: solo stili inline. Accento oro del brand.
// escapeHtml su tutto ciò che viene da dati utente (nome, url).
// =============================================================================

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr><td style="padding:28px 32px 8px;">
        <span style="display:inline-block;font-size:15px;font-weight:600;letter-spacing:-0.01em;">Coach AI</span>
      </td></tr>
      <tr><td style="padding:8px 32px 32px;">${inner}</td></tr>
    </table>
    <p style="max-width:480px;margin:16px auto 0;font-size:12px;color:#a1a1aa;text-align:center;">${esc(title)}</p>
  </td></tr></table>
</body></html>`;
}

function button(url: string, label: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;background:#e7bf70;color:#18130c;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:999px;">${esc(label)}</a>`;
}

// Invito di attivazione account: il cliente sceglie la password ed entra.
export function accessInviteEmail(opts: {
  clientName: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const first = opts.clientName.split(" ")[0] || opts.clientName;
  const inner = `
    <h1 style="margin:12px 0 8px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Ciao ${esc(first)} 👋</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3f3f46;">
      Il tuo coach ti ha preparato l'accesso alla tua app personale: scheda di
      allenamento, piano alimentare e messaggi. Imposta la password per entrare.
    </p>
    <p style="margin:0 0 24px;">${button(opts.url, "Attiva il mio accesso")}</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
      Se il pulsante non funziona, copia e incolla questo link nel browser:<br>
      <a href="${esc(opts.url)}" style="color:#a16207;word-break:break-all;">${esc(opts.url)}</a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">Il link scade tra 7 giorni.</p>`;
  const text = `Ciao ${first},
il tuo coach ti ha preparato l'accesso alla tua app (scheda, piano alimentare, messaggi).
Imposta la password e accedi qui: ${opts.url}
Il link scade tra 7 giorni.`;
  return {
    subject: "Attiva il tuo accesso a Coach AI",
    html: shell("Hai ricevuto questa email perché il tuo coach ti ha invitato su Coach AI.", inner),
    text,
  };
}

// Invito di onboarding: il cliente crea l'accesso e compila il questionario
// (un unico flusso), così l'AI può preparare le bozze per il coach.
export function onboardingInviteEmail(opts: {
  clientName: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const first = opts.clientName.split(" ")[0] || opts.clientName;
  const inner = `
    <h1 style="margin:12px 0 8px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Ciao ${esc(first)} 👋</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3f3f46;">
      Il tuo coach ti dà il benvenuto! Crea il tuo accesso e raccontaci di te —
      obiettivi, esperienza, attrezzatura e come mangi. Bastano pochi minuti: con
      queste risposte prepariamo il tuo programma e il piano alimentare su misura.
    </p>
    <p style="margin:0 0 24px;">${button(opts.url, "Inizia ora")}</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
      Se il pulsante non funziona, copia e incolla questo link nel browser:<br>
      <a href="${esc(opts.url)}" style="color:#a16207;word-break:break-all;">${esc(opts.url)}</a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">Il link scade tra 14 giorni.</p>`;
  const text = `Ciao ${first},
il tuo coach ti dà il benvenuto. Crea il tuo accesso e compila il questionario (obiettivi, allenamento, alimentazione) qui: ${opts.url}
Con le tue risposte prepariamo programma e piano alimentare su misura. Il link scade tra 14 giorni.`;
  return {
    subject: "Benvenuto! Inizia il tuo percorso · Coach AI",
    html: shell("Hai ricevuto questa email perché il tuo coach ti ha invitato su Coach AI.", inner),
    text,
  };
}
