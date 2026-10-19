// Modo de prueba: solo en el APK del emulador de CI (EXPO_PUBLIC_MODO_PRUEBA=1 al construir).
// Siembra un grupo de muestra y dos cargos con PIN conocidos para que Maestro recorra la
// reunión sin enrolamiento ni servidor. El AAB para Google Play se construye sin esta variable
// (TF1) y CI falla si la encuentra en ese build.

import type { FotoGrupo } from "../cola/grupo";
import type { BaseLocal } from "../datos/base";
import { registrarSincronizacion } from "../datos/caducidad";
import type { AlmacenSeguro } from "../seguridad/almacen";
import type { Cripto } from "../seguridad/cripto";
import { secretoDelDispositivo } from "../seguridad/dispositivo";
import { altaCargo, crearDek } from "../seguridad/llavero";
import { guardarPerfil, perfiles } from "../seguridad/perfiles";
import { PARAMS_PISO } from "../seguridad/pin";
import { guardarFoto } from "../cola/grupo";

export const MODO_PRUEBA = process.env.EXPO_PUBLIC_MODO_PRUEBA === "1";

export const PIN_PRUEBA = { presidente: "482916", portador_caja: "730185" } as const;

const id = (n: number, tipo: string) =>
  `00000000-0000-4000-8000-${tipo}${String(n).padStart(12 - tipo.length, "0")}`;

export const FOTO_PRUEBA: FotoGrupo = {
  formato: 1,
  generado_en: "2026-10-01T12:00:00Z",
  acap: { id: id(1, "a"), nombre: "ACAP de prueba" },
  ciclo: {
    id: id(1, "c"),
    numero: 1,
    fecha_inicio: "2026-01-10",
    duracion_meses: 12,
    valor_accion: 10_000,
    max_acciones_reunion: 5,
    valor_fondo_social: 2_000,
    valor_multa: 2_000,
    tasa_interes: "2.000",
  },
  miembros: Array.from({ length: 20 }, (_, i) => ({
    membresia_id: id(i + 1, "b"),
    titular_id: id(i + 1, "d"),
    numero: i + 1,
    activo: true,
    ahorro_ciclo: 0,
  })),
  cargos: [
    { id: id(1, "e"), tipo: "presidente", membresia_id: id(1, "b"), llaves: [] },
    { id: id(2, "e"), tipo: "portador_caja", membresia_id: id(2, "b"), llaves: [] },
  ],
  reuniones: [],
  prestamos: [],
  caja: 150_000,
};

/** Siembra el grupo de prueba la primera vez. No hace nada si ya hay perfiles. */
export async function sembrarModoPrueba(
  deps: { cripto: Cripto; almacen: AlmacenSeguro; abrirBase: (dek: Uint8Array) => Promise<BaseLocal> },
  ahora: Date,
): Promise<void> {
  if ((await perfiles(deps.almacen)).length > 0) return;
  const secreto = await secretoDelDispositivo(deps.cripto, deps.almacen);
  const dek = crearDek(deps.cripto);
  for (const [cargo, numero, pin] of [
    [FOTO_PRUEBA.cargos[0], 1, PIN_PRUEBA.presidente],
    [FOTO_PRUEBA.cargos[1], 2, PIN_PRUEBA.portador_caja],
  ] as const) {
    const llavero = await altaCargo(deps.cripto, { cargoId: cargo.id, pin, secreto, dek, params: PARAMS_PISO });
    await guardarPerfil(deps.almacen, { cargoId: cargo.id, tipo: cargo.tipo, numero }, llavero);
  }
  const base = await deps.abrirBase(dek);
  await guardarFoto(base, FOTO_PRUEBA);
  await registrarSincronizacion(base, ahora);
  await base.cerrar();
  dek.fill(0);
}
