// Préstamos internos tal como los entrega la API (por ACAP y número de miembro).

export interface Prestamo {
  id: string;
  acap_id: string;
  acap: string;
  zona: string;
  miembro: number | null;
  fecha: string;
  capital: number;
  tasa: number;
  cuotas: number;
  cuota: number;
  total: number;
  abonado: number;
  saldo: number;
  debidas: number;
  atraso: number;
  dias_atraso: number;
  estado: "pagado" | "mora" | "al_dia";
}

export const ESTADO_PRESTAMO = {
  pagado: { texto: "Pagado", tono: "neutro" },
  mora: { texto: "En mora", tono: "alerta" },
  al_dia: { texto: "Al día", tono: "bien" },
} as const;

export function fechaCorta(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}
