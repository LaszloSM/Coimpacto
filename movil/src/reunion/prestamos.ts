// Abonos (paso 5) y préstamos (paso 6) de la reunión (TX6b).
//
//   abono ──► elemento "abono" (id v5 por reunión y préstamo; corregir = contramovimiento, D9)
//   solicitud ──votación (D21)──► aprobada | no_aprobada
//   aprobadas ──firmas agrupadas (D10): cada firmante pone su PIN una vez y firma todas──►
//              un elemento "prestamo" por solicitud con las N firmas
//
// Las reglas de firma son las mismas que revalida el servidor (sync/servicio.py): N = 2
// personas distintas con cargos distintos, nunca el beneficiario (D13 de ingeniería).

import { calcularPrestamo, dividirAbono, ReglaInvalida } from "@credimpacto/reglas";

import { encolar, prepararElemento, type Elemento, type Firmante } from "../cola/cola";
import type { FotoGrupo } from "../cola/grupo";
import { idNatural } from "../cola/ids";
import type { BaseLocal } from "../datos/base";
import type { Cripto } from "../seguridad/cripto";
import type { Perfil } from "../seguridad/perfiles";
import type { Ciclo, ReunionLocal } from "./reunion";

export const FIRMAS_PRESTAMO = 2;

export type PrestamoFoto = FotoGrupo["prestamos"][number];

// --- abonos ---------------------------------------------------------------------------------

export async function abonoRegistrado(base: BaseLocal, reunionId: string, prestamoId: string) {
  return (
    (
      await base.primera<{ monto: number }>(
        "SELECT monto FROM registro_abono WHERE reunion_id = ? AND prestamo_id = ?;",
        reunionId,
        prestamoId,
      )
    )?.monto ?? 0
  );
}

/** Capital e interés del abono, con el saldo que bajó del servidor. Lanza si excede el saldo. */
export function partesAbono(prestamo: PrestamoFoto, monto: number) {
  return dividirAbono(monto, {
    saldo: prestamo.saldo,
    interes_mensual: (prestamo.total_pagar - prestamo.capital) / prestamo.num_cuotas,
    num_cuotas: prestamo.num_cuotas,
    total_pagar: prestamo.total_pagar,
  });
}

export async function registrarAbono(
  base: BaseLocal,
  cripto: Cripto,
  datos: { reunion: ReunionLocal; prestamo: PrestamoFoto; monto: number; firmante: Firmante; ahora: Date },
): Promise<void> {
  const { reunion, prestamo, monto } = datos;
  if (monto > 0) partesAbono(prestamo, monto); // valida antes de firmar
  const previo = await base.primera<{ version: number; monto: number; elementos: string }>(
    "SELECT version, monto, elementos FROM registro_abono WHERE reunion_id = ? AND prestamo_id = ?;",
    reunion.id,
    prestamo.id,
  );
  if ((previo?.monto ?? 0) === monto) return;
  const version = (previo?.version ?? 0) + 1;
  const elementos: Elemento[] = [];
  for (const original of previo ? (JSON.parse(previo.elementos) as string[]) : []) {
    elementos.push(
      await prepararElemento(
        cripto,
        {
          id: await idNatural(cripto, "correccion", original),
          tipo: "correccion",
          datos: { original, motivo: "Corregido en la reunión" },
        },
        [datos.firmante],
      ),
    );
  }
  const nuevos: string[] = [];
  if (monto > 0) {
    const id = await idNatural(cripto, "abono", reunion.id, prestamo.id, String(version));
    nuevos.push(id);
    elementos.push(
      await prepararElemento(
        cripto,
        { id, tipo: "abono", datos: { reunion: reunion.id, prestamo: prestamo.id, monto } },
        [datos.firmante],
      ),
    );
  }
  await base.transaccion(async (txn) => {
    for (const e of elementos) await encolar(txn, e, datos.ahora);
    await txn.correr(
      "INSERT INTO registro_abono (reunion_id, prestamo_id, version, monto, elementos) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT (reunion_id, prestamo_id) DO UPDATE SET version = excluded.version, " +
        "monto = excluded.monto, elementos = excluded.elementos;",
      reunion.id,
      prestamo.id,
      version,
      monto,
      JSON.stringify(nuevos),
    );
  });
}

// --- solicitudes y votación ---------------------------------------------------------------

export interface Votacion {
  aFavor: number;
  enContra: number;
  abstenciones: number;
  presentes: number;
}

export interface Solicitud extends Votacion {
  id: string;
  titularId: string;
  capital: number;
  numCuotas: number;
  estado: "aprobada" | "no_aprobada" | "firmada";
}

/** Quórum: presentes > 50 % de los miembros activos; aprobada: a favor > en contra (D21). */
export function resultadoVotacion(v: Votacion, miembrosActivos: number) {
  const quorum = v.presentes * 2 > miembrosActivos;
  const votos = v.aFavor + v.enContra + v.abstenciones;
  return {
    quorum,
    votosCuadran: votos <= v.presentes,
    aprobada: quorum && votos <= v.presentes && v.aFavor > v.enContra,
  };
}

/** Plan de cuotas que se muestra antes de firmar (D21), con las reglas del servidor. */
export function planDeCuotas(ciclo: Ciclo, capital: number, numCuotas: number) {
  return calcularPrestamo(capital, ciclo.tasa_interes, numCuotas);
}

export async function guardarSolicitud(
  base: BaseLocal,
  cripto: Cripto,
  datos: { reunion: ReunionLocal; titularId: string; capital: number; numCuotas: number; votacion: Votacion; activos: number; ciclo: Ciclo; prestamosVigentes: PrestamoFoto[] },
): Promise<Solicitud> {
  if (datos.prestamosVigentes.some((p) => p.titular_id === datos.titularId && p.saldo > 0)) {
    throw new ReglaInvalida("PRESTAMO_VIGENTE", datos.titularId);
  }
  planDeCuotas(datos.ciclo, datos.capital, datos.numCuotas); // valida montos
  const { aprobada } = resultadoVotacion(datos.votacion, datos.activos);
  const id = await idNatural(cripto, "prestamo", datos.reunion.id, datos.titularId);
  const firmada = await base.primera("SELECT 1 FROM solicitud_prestamo WHERE id = ? AND estado = 'firmada';", id);
  if (firmada) throw new ReglaInvalida("PRESTAMO_YA_FIRMADO", id);
  const v = datos.votacion;
  await base.correr(
    "INSERT INTO solicitud_prestamo (id, reunion_id, titular_id, capital, num_cuotas, a_favor, en_contra, abstenciones, presentes, estado) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET capital = excluded.capital, " +
      "num_cuotas = excluded.num_cuotas, a_favor = excluded.a_favor, en_contra = excluded.en_contra, " +
      "abstenciones = excluded.abstenciones, presentes = excluded.presentes, estado = excluded.estado;",
    id,
    datos.reunion.id,
    datos.titularId,
    datos.capital,
    datos.numCuotas,
    v.aFavor,
    v.enContra,
    v.abstenciones,
    v.presentes,
    aprobada ? "aprobada" : "no_aprobada",
  );
  return { id, titularId: datos.titularId, capital: datos.capital, numCuotas: datos.numCuotas, ...v, estado: aprobada ? "aprobada" : "no_aprobada" };
}

export async function solicitudes(base: BaseLocal, reunionId: string): Promise<Solicitud[]> {
  const filas = await base.todas<{
    id: string;
    titular_id: string;
    capital: number;
    num_cuotas: number;
    a_favor: number;
    en_contra: number;
    abstenciones: number;
    presentes: number;
    estado: Solicitud["estado"];
  }>("SELECT * FROM solicitud_prestamo WHERE reunion_id = ? ORDER BY rowid;", reunionId);
  return filas.map((f) => ({
    id: f.id,
    titularId: f.titular_id,
    capital: f.capital,
    numCuotas: f.num_cuotas,
    aFavor: f.a_favor,
    enContra: f.en_contra,
    abstenciones: f.abstenciones,
    presentes: f.presentes,
    estado: f.estado,
  }));
}

// --- firmas agrupadas ----------------------------------------------------------------------

export interface FirmanteCargo extends Firmante {
  perfil: Perfil;
}

export type MotivoFirmaInvalida = "mismo_cargo" | "misma_persona" | "beneficiario";

/** Por qué este cargo no puede firmar junto a los que ya firmaron (o null si puede). */
export function puedeFirmar(
  candidato: Perfil,
  yaFirmaron: Perfil[],
  beneficiarios: string[],
  foto: Pick<FotoGrupo, "miembros">,
): MotivoFirmaInvalida | null {
  if (yaFirmaron.some((p) => p.tipo === candidato.tipo)) return "mismo_cargo";
  if (yaFirmaron.some((p) => p.numero === candidato.numero)) return "misma_persona";
  const titular = foto.miembros.find((m) => m.numero === candidato.numero)?.titular_id;
  if (titular && beneficiarios.includes(titular)) return "beneficiario";
  return null;
}

/**
 * Firma todas las solicitudes aprobadas de la reunión con los firmantes (cada uno puso su PIN
 * una sola vez) y las encola juntas: o salen todas o ninguna (D11 de diseño: nunca firmas a
 * medias).
 */
export async function firmarPrestamos(
  base: BaseLocal,
  cripto: Cripto,
  datos: { reunion: ReunionLocal; firmantes: FirmanteCargo[]; foto: Pick<FotoGrupo, "miembros">; ahora: Date },
): Promise<number> {
  const pendientes = (await solicitudes(base, datos.reunion.id)).filter((s) => s.estado === "aprobada");
  if (pendientes.length === 0) return 0;
  if (datos.firmantes.length < FIRMAS_PRESTAMO) throw new ReglaInvalida("FIRMAS_INSUFICIENTES");
  const beneficiarios = pendientes.map((s) => s.titularId);
  datos.firmantes.forEach((f, i) => {
    const motivo = puedeFirmar(f.perfil, datos.firmantes.slice(0, i).map((x) => x.perfil), beneficiarios, datos.foto);
    if (motivo) throw new ReglaInvalida("FIRMA_NO_VALIDA", motivo);
  });
  const elementos: Elemento[] = [];
  for (const s of pendientes) {
    elementos.push(
      await prepararElemento(
        cripto,
        {
          id: s.id,
          tipo: "prestamo",
          datos: {
            reunion: datos.reunion.id,
            titular: s.titularId,
            id_desembolso: await idNatural(cripto, "desembolso", s.id),
            capital: s.capital,
            num_cuotas: s.numCuotas,
            votacion: { a_favor: s.aFavor, en_contra: s.enContra, abstenciones: s.abstenciones, presentes: s.presentes },
          },
        },
        datos.firmantes,
      ),
    );
  }
  await base.transaccion(async (txn) => {
    for (const e of elementos) await encolar(txn, e, datos.ahora);
    for (const s of pendientes) await txn.correr("UPDATE solicitud_prestamo SET estado = 'firmada' WHERE id = ?;", s.id);
  });
  return pendientes.length;
}
