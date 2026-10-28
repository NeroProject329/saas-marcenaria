import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import PwaRegister from "@/components/pwa/PwaRegister";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "Gestão Marcenaria",
  description: "Gestão de orçamentos, pedidos, financeiro e estoque para marcenarias.",
  applicationName: "Gestão Marcenaria",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Marcenaria",
  },
  icons: {
    icon: [{ url: "/app-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#24324A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${ui.variable}`}>
      <body>
        <PwaRegister />
        <div className="app-bg">{children}</div>
      </body>
    </html>
  );
}
