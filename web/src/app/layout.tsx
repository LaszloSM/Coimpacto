import type { Metadata, Viewport } from "next";
import { t } from "@/i18n";
// Fuentes y tokens salen de packages/tokens (generados desde DESIGN.md); Next empaqueta las
// fuentes con la web, así que ni el build ni el navegador dependen de Google Fonts.
import "@credimpacto/tokens/css/fuentes.css";
import "@credimpacto/tokens/css/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.nombre"),
  description: t("app.descripcion"),
};

export const viewport: Viewport = {
  themeColor: "#F2F3F0",
  colorScheme: "light",
  // Pinta bajo el notch (el contenido se aleja con env(safe-area-inset-*)) y el teclado de
  // Android achica la vista en vez de tapar los campos.
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}
