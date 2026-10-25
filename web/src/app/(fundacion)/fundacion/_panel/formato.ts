// Formatos del panel en es-CO. El dinero va en pesos enteros; las cifras grandes se resumen en
// millones o miles, siempre con la cifra exacta disponible para el lector de pantalla.

import { formatearPesos } from "@credimpacto/reglas";

const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/** "$ 97,5 M", "$ 850 mil", "$ 12.000". */
export function pesosCortos(pesos: number): string {
  const absoluto = Math.abs(pesos);
  const signo = pesos < 0 ? "−" : "";
  if (absoluto >= 1_000_000) return `${signo}$ ${decimal.format(absoluto / 1_000_000)} M`;
  if (absoluto >= 10_000) return `${signo}$ ${decimal.format(Math.round(absoluto / 1_000))} mil`;
  return formatearPesos(pesos);
}

export const pesosExactos = formatearPesos;

export function porcentaje(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "Sin datos" : `${decimal.format(valor)} %`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10" → "oct" */
export function mesCorto(aaaaMm: string): string {
  return MESES[Number(aaaaMm.slice(5, 7)) - 1] ?? aaaaMm;
}

export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
