import type { Metadata } from "next";

import { t } from "@/i18n";

// El enlace es privado de un miembro: que no lo indexen ni se filtre por el Referer.
export const metadata: Metadata = {
  title: t("comprobante.titulo"),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
