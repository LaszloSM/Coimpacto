// "Atrás" de Android guiado según el momento (N11). Una sola función decide qué hace atrás en
// el asistente, para probarla sin pantalla: nunca pierde datos y nunca deja firmas a medias.

export type Atras =
  | { tipo: "ir"; paso: number; miembro?: number }
  | { tipo: "confirmar-salir" }
  | { tipo: "nada" };

/** Qué hace atrás en el asistente, según el paso y el miembro en que va (D1, D14). */
export function atrasEnAsistente(datos: { paso: number; miembro: number; hayReunion: boolean; ultimoMiembro: number }): Atras {
  if (!datos.hayReunion || datos.paso <= 1) return { tipo: "confirmar-salir" };
  if (datos.paso === 4) {
    return datos.miembro > 0 ? { tipo: "ir", paso: 4, miembro: datos.miembro - 1 } : { tipo: "ir", paso: 3 };
  }
  // Antes del 2 está abrir (ya hecho) y lo respondido en el 2 ya está firmado: atrás es salir.
  if (datos.paso === 2 || datos.paso === 3) return { tipo: "confirmar-salir" };
  if (datos.paso === 5) return { tipo: "ir", paso: 4, miembro: datos.ultimoMiembro };
  if (datos.paso === 9) return { tipo: "nada" }; // la reunión ya se cerró: no se vuelve al cierre
  return { tipo: "ir", paso: datos.paso - 1 };
}

export const TEXTO_SALIR = { titulo: "¿Salir de la reunión?", mensaje: "Todo queda guardado aquí.", si: "Salir", no: "Seguir aquí" };
export const TEXTO_CANCELAR_FIRMAS = {
  titulo: "¿Cancelar estas firmas?",
  mensaje: "No se guarda ninguna de este grupo.",
  si: "Cancelar las firmas",
  no: "Seguir firmando",
};
