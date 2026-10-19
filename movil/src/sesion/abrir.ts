// Abrir la sesión de quien opera (D10, D14): su PIN abre su llavero, el llavero da la DEK y la
// DEK abre la base cifrada. Los 5 intentos se cuentan antes de probar (TX3).

import type { FotoGrupo } from "../cola/grupo";
import type { BaseLocal } from "../datos/base";
import type { AlmacenSeguro } from "../seguridad/almacen";
import type { Cripto } from "../seguridad/cripto";
import { secretoDelDispositivo } from "../seguridad/dispositivo";
import { ControlIntentos } from "../seguridad/intentos";
import { abrirCargo } from "../seguridad/llavero";
import { llaveroDe, type Perfil } from "../seguridad/perfiles";

export const NOMBRE_BASE = "reunion.db";

export interface Sesion {
  base: BaseLocal;
  cripto: Cripto;
  perfil: Perfil;
  firmante: { llaveId: string; privada: CryptoKey };
}

export type AbrirBase = (dek: Uint8Array) => Promise<BaseLocal>;

export async function abrirSesion(
  deps: { cripto: Cripto; almacen: AlmacenSeguro; abrirBase: AbrirBase },
  perfil: Perfil,
  pin: string,
): Promise<Sesion> {
  const llavero = await llaveroDe(deps.almacen, perfil.cargoId);
  if (!llavero) throw new Error("Este cargo no está registrado en este celular.");
  const secreto = await secretoDelDispositivo(deps.cripto, deps.almacen);
  const abierto = await new ControlIntentos(deps.almacen).intentar(perfil.cargoId, () =>
    abrirCargo(deps.cripto, llavero, pin, secreto),
  );
  const base = await deps.abrirBase(abierto.dek);
  abierto.dek.fill(0);
  return { base, cripto: deps.cripto, perfil, firmante: { llaveId: llavero.llaveId, privada: abierto.privada } };
}

/** Reconstruye la foto del grupo desde la copia guardada (null si nunca se bajó o caducó). */
export async function leerFoto(base: BaseLocal): Promise<FotoGrupo | null> {
  const filas = await base.todas<{ id: string; datos: string; descargado_en: string }>("SELECT * FROM grupo;");
  if (filas.length === 0) return null;
  const parte = Object.fromEntries(filas.map((f) => [f.id, JSON.parse(f.datos)]));
  const miembros = await base.todas<{
    membresia_id: string;
    titular_id: string;
    numero: number;
    activo: number;
    ahorro_ciclo: number;
    iniciales: string;
  }>("SELECT membresia_id, titular_id, numero, activo, ahorro_ciclo, iniciales FROM miembros ORDER BY numero;");
  return {
    formato: 1,
    generado_en: filas[0].descargado_en,
    acap: parte.acap,
    ciclo: parte.ciclo ?? null,
    cargos: parte.cargos ?? [],
    reuniones: parte.reuniones ?? [],
    prestamos: parte.prestamos ?? [],
    caja: parte.caja ?? 0,
    ultima_reunion: parte.ultima_reunion ?? null,
    comprobantes: parte.comprobantes ?? null,
    propuestas: parte.propuestas ?? [],
    miembros: miembros.map(({ iniciales, ...m }) => ({ ...m, activo: m.activo === 1, nombre_corto: iniciales || null })),
  };
}

/** Abre solo la llave de firma de otro cargo (firmas agrupadas, D10): su PIN, sus 5 intentos. */
export async function abrirFirmante(
  deps: { cripto: Cripto; almacen: AlmacenSeguro },
  perfil: Perfil,
  pin: string,
): Promise<{ llaveId: string; privada: CryptoKey; perfil: Perfil }> {
  const llavero = await llaveroDe(deps.almacen, perfil.cargoId);
  if (!llavero) throw new Error("Este cargo no está registrado en este celular.");
  const secreto = await secretoDelDispositivo(deps.cripto, deps.almacen);
  const abierto = await new ControlIntentos(deps.almacen).intentar(perfil.cargoId, () =>
    abrirCargo(deps.cripto, llavero, pin, secreto),
  );
  abierto.dek.fill(0);
  return { llaveId: llavero.llaveId, privada: abierto.privada, perfil };
}
