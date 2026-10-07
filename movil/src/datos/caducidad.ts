// Caducidad de los datos descargados (D5): a los 60 días sin sincronizar se borra la copia del
// servidor (lista del grupo, ciclo). Lo escrito en el celular nunca se borra por caducidad.
// Los avisos de 30 y 60 días (N3) los muestra la vista con `diasSinSincronizar`.

import type { BaseLocal } from "./base";

export const DIAS_CADUCIDAD = 60;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Tablas que son copia del servidor y pueden volver a bajarse. Nunca `pendientes`. */
const TABLAS_DESCARGADAS = ["grupo", "miembros"] as const;

export async function registrarSincronizacion(base: BaseLocal, ahora: Date): Promise<void> {
  await base.correr(
    "INSERT INTO meta (clave, valor) VALUES ('ultima_sincronizacion', ?) " +
      "ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor;",
    ahora.toISOString(),
  );
}

/** Días completos desde la última sincronización; null si nunca se sincronizó. */
export async function diasSinSincronizar(base: BaseLocal, ahora: Date): Promise<number | null> {
  const fila = await base.primera<{ valor: string }>(
    "SELECT valor FROM meta WHERE clave = 'ultima_sincronizacion';",
  );
  if (!fila) return null;
  return Math.floor((ahora.getTime() - Date.parse(fila.valor)) / DIA_MS);
}

/** Borra la copia del servidor si pasaron 60 días. Devuelve true si la borró. */
export async function aplicarCaducidad(base: BaseLocal, ahora: Date): Promise<boolean> {
  const dias = await diasSinSincronizar(base, ahora);
  if (dias === null || dias < DIAS_CADUCIDAD) return false;
  await base.transaccion(async (txn) => {
    for (const tabla of TABLAS_DESCARGADAS) await txn.ejecutar(`DELETE FROM ${tabla};`);
  });
  return true;
}
