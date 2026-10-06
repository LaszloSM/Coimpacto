import type { Metadata, Viewport } from "next";
import { t } from "@/i18n";
import "@/estilos/fuentes.css";
import "@/estilos/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.nombre"),
  description: t("app.descripcion"),
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  colorScheme: "light",
};

// Las fuentes son archivos propios (public/fuentes): se precargan las del español.
const PRECARGA = ["/fuentes/atkinson-next-latin.woff2", "/fuentes/bitter-latin.woff2"];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <head>
        {PRECARGA.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
