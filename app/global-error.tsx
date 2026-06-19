"use client";

// Boundary d'errore globale: sostituisce l'intero documento se fallisce il
// layout radice, quindi deve includere <html>/<body>. Stili inline perché il
// CSS dell'app potrebbe non essere caricato.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="it">
      <body
        style={{
          background: "#08090a",
          color: "#f7f8f8",
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
        <p style={{ fontSize: "14px", color: "#8a8f98" }}>
          Ricarica la pagina per continuare.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "#f7f8f8",
            color: "#08090a",
            border: "none",
            borderRadius: "9999px",
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
