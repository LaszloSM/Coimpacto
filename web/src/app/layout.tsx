import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Bitter } from "next/font/google";
import { t } from "@/i18n";
import "@/estilos/tokens.css";
import "./globals.css";

// Fuentes autoalojadas por next/font en el build: en campo no se depende de Google.
const atkinsonNext = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800"],
  variable: "--fuente-atkinson-next",
  display: "swap",
  // Next no trae métricas de Atkinson para ajustar el fallback; se usa la del sistema tal cual.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--fuente-atkinson-mono",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});
const bitter = Bitter({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--fuente-bitter",
  display: "swap",
});

export const metadata: Metadata = {
  title: t("app.nombre"),
  description: t("app.descripcion"),
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-CO"
      className={`${atkinsonNext.variable} ${atkinsonMono.variable} ${bitter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
