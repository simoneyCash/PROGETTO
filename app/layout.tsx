import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// Inter Variable self-hosted (next/font la scarica a build-time e la serve dal
// nostro dominio → funziona offline nella PWA). Espone --font-inter, a cui
// punta --font-sans in globals.css. Feature cv01/ss03 impostate sul body.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Coach AI",
  description:
    "Piattaforma per coach e nutrizionisti: l'AI fa il lavoro ripetitivo, il coach resta sempre in controllo.",
  applicationName: "Coach AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Coach AI",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#08090a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`dark ${inter.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
