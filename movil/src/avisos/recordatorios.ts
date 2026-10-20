// Recordatorios locales del ciclo (N14, TD7): el día antes de la próxima reunión, a las 8:00.
// Nunca muestran montos ni nombres de personas (N12): "Mañana hay reunión de [ACAP]" y, para el
// socio con préstamo, "Se acerca su cuota". La fecha de la próxima reunión la pone la junta al
// cerrar; se guarda fuera de la base (solo la fecha).

import type { AlmacenSeguro } from "../seguridad/almacen";

const PROXIMA = "reunion.proxima";
export const OPCIONES_PROXIMA = [
  { dias: 7, texto: "En 1 semana" },
  { dias: 14, texto: "En 2 semanas" },
  { dias: 30, texto: "En 1 mes" },
] as const;

export interface Recordatorio {
  id: string;
  titulo: string;
  cuerpo: string;
  cuando: Date;
}

/** Fecha (AAAA-MM-DD) de la próxima reunión a partir de hoy. */
export function fechaProxima(hoy: Date, dias: number): string {
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias));
  return d.toISOString().slice(0, 10);
}

/** Los recordatorios que tocan para esa reunión; ninguno si la fecha ya pasó. */
export function recordatoriosPara(datos: {
  proxima: string;
  acap: string;
  sociosConPrestamo: number;
  ahora: Date;
}): Recordatorio[] {
  const [a, m, d] = datos.proxima.split("-").map(Number);
  const cuando = new Date(a, m - 1, d - 1, 8, 0, 0);
  if (cuando.getTime() <= datos.ahora.getTime()) return [];
  const lista: Recordatorio[] = [
    { id: `reunion-${datos.proxima}`, titulo: "Credimpacto", cuerpo: `Mañana hay reunión de ${datos.acap}.`, cuando },
  ];
  if (datos.sociosConPrestamo > 0) {
    lista.push({ id: `cuota-${datos.proxima}`, titulo: "Credimpacto", cuerpo: "Se acerca su cuota.", cuando });
  }
  return lista;
}

export const guardarProxima = (almacen: AlmacenSeguro, fecha: string) => almacen.escribir(PROXIMA, fecha);
export const leerProxima = (almacen: AlmacenSeguro) => almacen.leer(PROXIMA);

/** Programador de avisos: en el celular es expo-notifications; en Jest, una lista en memoria. */
export interface Programador {
  pedirPermiso(): Promise<boolean>;
  cancelarTodos(): Promise<void>;
  programar(r: Recordatorio): Promise<void>;
}

/** Reprograma los avisos de la próxima reunión. Sin permiso, la app sigue igual. */
export async function reprogramar(
  programador: Programador,
  datos: { proxima: string | null; acap: string; sociosConPrestamo: number; ahora: Date },
): Promise<number> {
  await programador.cancelarTodos();
  if (!datos.proxima) return 0;
  const lista = recordatoriosPara({ ...datos, proxima: datos.proxima });
  for (const r of lista) await programador.programar(r);
  return lista.length;
}
