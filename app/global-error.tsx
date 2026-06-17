"use client";

// Boundary d'errore globale: sostituisce l'intero documento se fallisce il
// layout radice, quindi deve includere <html>/<body>. Stili inline perché il
// CSS dell'app potrebbe non essere caricato.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="it">
      <body
        style={{
          background: "#050605",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 600 }}>
          Qualcosa è andato storto
        </h1>
        <p style={{ fontSize: "14px", color: "#a3a3a3" }}>
          Ricarica la pagina per continuare.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "#e7bf70",
            color: "#18130c",
            border: "none",
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Riprova
        </button>
      </body>
    </html>
  );
}
