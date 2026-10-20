import { pesos, ReglaInvalida } from "./aritmetica";

// Quórum y aprobación de un préstamo (ET2). Espejo de resultado_votacion en
// backend/libro/reglas.py; los dos corren packages/casos-reglas/casos/votacion.json.

export type Mayoria = "simple" | "absoluta";

export interface EntradaVotacion {
  presentes: number;
  a_favor: number;
  en_contra: number;
  abstenciones: number;
  activos: number;
  /** Quórum: presentes × 100 > quorum_porcentaje × activos (por defecto 50, entre 1 y 99). */
  quorum_porcentaje: number;
  /** simple: a favor > en contra; absoluta: a favor × 2 > presentes. */
  mayoria: string;
}

export function resultadoVotacion(e: EntradaVotacion): { quorum: boolean; votos_cuadran: boolean; aprobada: boolean } {
  for (const n of [e.presentes, e.a_favor, e.en_contra, e.abstenciones, e.activos]) pesos(n);
  if (!Number.isInteger(e.quorum_porcentaje) || e.quorum_porcentaje < 1 || e.quorum_porcentaje > 99) {
    throw new ReglaInvalida("QUORUM_INVALIDO", String(e.quorum_porcentaje));
  }
  if (e.mayoria !== "simple" && e.mayoria !== "absoluta") throw new ReglaInvalida("MAYORIA_INVALIDA", e.mayoria);
  const quorum = e.presentes * 100 > e.quorum_porcentaje * e.activos;
  const votosCuadran = e.a_favor + e.en_contra + e.abstenciones <= e.presentes;
  const gana = e.mayoria === "simple" ? e.a_favor > e.en_contra : e.a_favor * 2 > e.presentes;
  return { quorum, votos_cuadran: votosCuadran, aprobada: quorum && votosCuadran && gana };
}
