import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

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
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className="dark">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
