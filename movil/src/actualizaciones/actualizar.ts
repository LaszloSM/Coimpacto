// Actualizaciones de la app por el servidor propio (TX9, D9, N16).
// Nunca durante una reunión ni con algo por subir: "Primero enviamos lo guardado, después se
// instala la versión nueva." Con datos móviles se pregunta antes de bajar.

import type { BaseLocal } from "../datos/base";

export interface Actualizador {
  habilitado: boolean;
  hayNueva(): Promise<boolean>;
  bajar(): Promise<void>;
  aplicar(): Promise<void>;
}

export type ResultadoActualizacion =
  | "deshabilitado"
  | "espera-pendientes"
  | "espera-reunion"
  | "nada"
  | "sin-permiso-datos"
  | "lista";

/** Se puede instalar solo sin pendientes y sin reunión abierta (D9). */
export async function puedeActualizar(base: BaseLocal): Promise<"si" | "espera-pendientes" | "espera-reunion"> {
  const pendientes = await base.primera<{ n: number }>("SELECT count(*) AS n FROM pendientes WHERE estado = 'pendiente';");
  if ((pendientes?.n ?? 0) > 0) return "espera-pendientes";
  const abierta = await base.primera("SELECT 1 FROM reunion_local WHERE estado = 'abierta';");
  return abierta ? "espera-reunion" : "si";
}

/**
 * Busca y baja una versión nueva si se puede. No la aplica: la app la instala cuando la junta
 * toca "Instalar" (recarga la app), así nunca se reinicia sola en medio de algo.
 */
export async function buscarActualizacion(
  base: BaseLocal,
  deps: { actualizador: Actualizador; conDatosMoviles: () => Promise<boolean>; preguntarDatosMoviles: () => Promise<boolean> },
): Promise<ResultadoActualizacion> {
  if (!deps.actualizador.habilitado) return "deshabilitado";
  const permitido = await puedeActualizar(base);
  if (permitido !== "si") return permitido;
  if (!(await deps.actualizador.hayNueva())) return "nada";
  if ((await deps.conDatosMoviles()) && !(await deps.preguntarDatosMoviles())) return "sin-permiso-datos";
  await deps.actualizador.bajar();
  return "lista";
}
