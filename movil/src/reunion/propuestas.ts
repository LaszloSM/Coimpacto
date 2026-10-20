// Paso 2 "Cambios desde la última" (D7, ET3): las propuestas del facilitador sobre registros por
// aclarar. La junta acepta con N firmas de cargos distintos, o no acepta con un motivo de la
// lista; la respuesta es un elemento firmado que sube con lo demás. Nada cambia en el libro
// hasta que el servidor la recibe.

import { ReglaInvalida } from "@credimpacto/reglas";

import { encolar, prepararElemento, type Firmante } from "../cola/cola";
import type { FotoGrupo, PropuestaFoto } from "../cola/grupo";
import { idNatural } from "../cola/ids";
import type { BaseLocal } from "../datos/base";
import type { Cripto } from "../seguridad/cripto";
import { FIRMAS_PRESTAMO, puedeFirmar, type FirmanteCargo } from "./prestamos";

/** Motivos de "No aceptar" (los mismos ids que el servidor, sync/propuestas.py). */
export const MOTIVOS_NO_ACEPTAR = [
  { id: "si_se_recibio", texto: "Sí se recibió ese dinero" },
  { id: "otro_monto", texto: "El monto es otro" },
  { id: "otro_miembro", texto: "Es de otro miembro" },
  { id: "otro", texto: "Otro motivo" },
] as const;
export type MotivoNoAceptar = (typeof MOTIVOS_NO_ACEPTAR)[number]["id"];

const NOMBRE_TIPO: Record<string, string> = {
  ahorro: "Ahorro",
  fondo_social: "Fondo social",
  multa: "Multa",
  abono: "Abono",
  desembolso: "Préstamo entregado",
  venta: "Venta",
  faltante: "Faltante de caja",
  sobrante: "Sobrante de caja",
};

export const nombreDelRegistro = (tipo: string) => NOMBRE_TIPO[tipo] ?? "Registro";

/** Propuestas de la foto que este celular todavía no respondió. */
export async function porResponder(base: BaseLocal, foto: Pick<FotoGrupo, "propuestas">): Promise<PropuestaFoto[]> {
  const filas = await base.todas<{ carga: string }>("SELECT carga FROM pendientes WHERE tipo = 'respuesta_propuesta';");
  const respondidas = new Set(filas.map((f) => (JSON.parse(f.carga) as { datos: { propuesta: string } }).datos.propuesta));
  return (foto.propuestas ?? []).filter((p) => !respondidas.has(p.id));
}

async function guardar(
  base: BaseLocal,
  cripto: Cripto,
  propuesta: PropuestaFoto,
  datos: { [clave: string]: string },
  firmantes: Firmante[],
  ahora: Date,
) {
  const elemento = await prepararElemento(
    cripto,
    {
      id: await idNatural(cripto, "respuesta_propuesta", propuesta.id),
      tipo: "respuesta_propuesta",
      datos: { propuesta: propuesta.id, ...datos },
    },
    firmantes,
  );
  await base.transaccion((txn) => encolar(txn, elemento, ahora));
}

/** La junta acepta: N firmas de cargos y personas distintas (D13). */
export async function aceptar(
  base: BaseLocal,
  cripto: Cripto,
  datos: { propuesta: PropuestaFoto; firmantes: FirmanteCargo[]; foto: Pick<FotoGrupo, "miembros">; ahora: Date },
): Promise<void> {
  if (datos.firmantes.length < FIRMAS_PRESTAMO) throw new ReglaInvalida("FIRMAS_INSUFICIENTES");
  datos.firmantes.forEach((f, i) => {
    const motivo = puedeFirmar(f.perfil, datos.firmantes.slice(0, i).map((x) => x.perfil), [], datos.foto);
    if (motivo) throw new ReglaInvalida("FIRMA_NO_VALIDA", motivo);
  });
  await guardar(base, cripto, datos.propuesta, { respuesta: "acepta" }, datos.firmantes, datos.ahora);
}

/** La junta no acepta: quien opera firma, con el motivo y una nota opcional (D3 = A). */
export async function noAceptar(
  base: BaseLocal,
  cripto: Cripto,
  datos: { propuesta: PropuestaFoto; motivo: MotivoNoAceptar; nota: string; firmante: Firmante; ahora: Date },
): Promise<void> {
  const nota = datos.nota.trim().slice(0, 300);
  await guardar(
    base,
    cripto,
    datos.propuesta,
    { respuesta: "no_acepta", motivo: datos.motivo, ...(nota ? { nota } : {}) },
    [datos.firmante],
    datos.ahora,
  );
}
