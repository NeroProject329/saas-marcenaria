import type { Metadata } from "next";
import "./globals.css";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";

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
  title: "Gestão Marcenaria — Painel",
  description: "Dashboard premium para Marcenaria SaaS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${ui.variable}`}>
      <body>
        <div className="app-bg">{children}</div>
      </body>
    </html>
  );
}