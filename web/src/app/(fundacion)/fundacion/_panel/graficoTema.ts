// Voz de los gráficos del panel (Recharts): naranja = ahorro, azul de CoimpactoB = crédito,
// tinta = miembros, verde = fondo social y lo que va bien. Ejes tenues, rejilla casi invisible.

import { useSyncExternalStore } from "react";

export const COLOR = {
  naranja: "#F66A03",
  azul: "#005FC5",
  tinta: "#10213D",
  carbon: "#10213D",
  gris: "#C5CDD9",
  verde: "#2F8A5B",
  amarillo: "#E3A21A",
  rojo: "#D4483B",
};

export const REJILLA = "#ECEFF3";
export const EJE = { fontSize: 12, fill: "#5B6678", fontFamily: "var(--fuente-atkinson-next)" };
export const CURSOR_BARRA = { fill: "rgb(16 33 61 / 0.04)" };
export const CURSOR_LINEA = { stroke: "#C5CDD9", strokeDasharray: "3 3" };

// "Reducir movimiento" del sistema, leído sin setState dentro de un efecto.
function suscribir(aviso: () => void) {
  const consulta = window.matchMedia("(prefers-reduced-motion: no-preference)");
  consulta.addEventListener("change", aviso);
  return () => consulta.removeEventListener("change", aviso);
}

/** Los gráficos crecen al cargar (450 ms, ease-out) salvo con "reducir movimiento". */
export function useAnimar(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
    () => false,
  );
}
