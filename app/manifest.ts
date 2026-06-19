import type { MetadataRoute } from "next";

// Generates /manifest.webmanifest. Next automatically links it from <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coach AI",
    short_name: "Coach AI",
    description:
      "Piattaforma per coach e nutrizionisti: l'AI fa il lavoro ripetitivo, il coach resta sempre in controllo.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08090a",
    theme_color: "#08090a",
    lang: "it",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
