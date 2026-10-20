// Arqueo (paso 7), cierre (paso 8) y resumen por miembro (paso 9) (TX6c).
//
//   lo esperado = caja con que abrió + lo que entró hoy − lo que salió hoy (desembolsos)
//                 (todo sale de la cola de esta reunión, con los precios del ciclo)
//   arqueo a ciegas ──► contado; si difiere, faltante o sobrante con motivo (D12)
//   cierre ──firmas agrupadas──► elemento "cierre" con la lista de movimientos y la caja
//
// El servidor recalcula y revalida todo; aquí se calcula para que la junta cuadre la caja
// en la reunión, sin señal.

import { ReglaInvalida } from "@credimpacto/reglas";

import { encolar, prepararElemento, type Elemento } from "../cola/cola";
import type { FotoGrupo, MiembroFoto } from "../cola/grupo";
import { idNatural } from "../cola/ids";
import type { BaseLocal } from "../datos/base";
import type { Cripto } from "../seguridad/cripto";
import { FIRMAS_PRESTAMO, planDeCuotas, puedeFirmar, type FirmanteCargo } from "./prestamos";
import { aportesRegistrados, montos, type Ciclo, type ReunionLocal } from "./reunion";

/** Billetes de la familia nueva del Banco de la República, con su color real (DESIGN.md). */
export const BILLETES = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000] as const;
export const MONEDAS = [1_000, 500, 200, 100, 50] as const;
export type Conteo = Record<number, number>;

export const totalConteo = (conteo: Conteo) =>
  Object.entries(conteo).reduce((suma, [valor, cantidad]) => suma + Number(valor) * (cantidad ?? 0), 0);

/** Elementos de la cola que pertenecen a esta reunión, en el orden en que se registraron. */
export async function elementosDeLaReunion(base: BaseLocal, reunionId: string): Promise<Elemento[]> {
  const todos = (await base.todas<{ carga: string }>("SELECT carga FROM pendientes ORDER BY rowid;")).map(
    (f) => JSON.parse(f.carga) as Elemento,
  );
  const ids = new Set<string>();
  const propios: Elemento[] = [];
  for (const e of todos) {
    const deEsta =
      e.datos.reunion === reunionId || (e.tipo === "correccion" && ids.has(String(e.datos.original)));
    if (deEsta || e.id === reunionId) {
      ids.add(e.id);
      propios.push(e);
    }
  }
  return propios;
}

/** Pesos con signo que mueve cada elemento en la caja (positivo entra, negativo sale). */
export function efectoEnCaja(elementos: Elemento[], ciclo: Ciclo): number {
  const efecto = new Map<string, number>();
  let total = 0;
  for (const e of elementos) {
    const d = e.datos as Record<string, number | string>;
    let pesos = 0;
    if (e.tipo === "ahorro") pesos = Number(d.acciones) * ciclo.valor_accion;
    else if (e.tipo === "multa") pesos = Number(d.cantidad) * ciclo.valor_multa;
    else if (e.tipo === "abono") pesos = Number(d.monto);
    else if (e.tipo === "prestamo") pesos = -Number(d.capital);
    else if (e.tipo === "movimiento") pesos = d.tipo === "faltante" ? -Number(d.monto) : Number(d.monto);
    else if (e.tipo === "correccion") pesos = -(efecto.get(String(d.original)) ?? 0);
    efecto.set(e.id, pesos);
    total += pesos;
  }
  return total;
}

/** Lo que debería haber en la caja ahora, sin contar faltantes ni sobrantes del arqueo. */
export async function esperadoEnCaja(base: BaseLocal, reunion: ReunionLocal, foto: FotoGrupo): Promise<number> {
  const elementos = (await elementosDeLaReunion(base, reunion.id)).filter(
    (e) => !(e.tipo === "movimiento" && (e.datos.tipo === "faltante" || e.datos.tipo === "sobrante")),
  );
  return (foto.caja ?? 0) + efectoEnCaja(elementos, foto.ciclo!);
}

export interface Arqueo {
  conteo: Conteo;
  contado: number;
  esperado: number;
  motivo: string;
  cerradaEn: string | null;
}

export async function arqueoGuardado(base: BaseLocal, reunionId: string): Promise<Arqueo | null> {
  const fila = await base.primera<{ conteo: string; contado: number; esperado: number; motivo: string; cerrada_en: string | null }>(
    "SELECT * FROM arqueo WHERE reunion_id = ?;",
    reunionId,
  );
  return fila
    ? { conteo: JSON.parse(fila.conteo), contado: fila.contado, esperado: fila.esperado, motivo: fila.motivo, cerradaEn: fila.cerrada_en }
    : null;
}

/** Guarda lo contado a ciegas (aún sin diferencia firmada). Se puede volver a contar. */
export async function guardarConteo(base: BaseLocal, reunionId: string, conteo: Conteo, esperado: number) {
  await base.correr(
    "INSERT INTO arqueo (reunion_id, conteo, contado, esperado) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (reunion_id) DO UPDATE SET conteo = excluded.conteo, contado = excluded.contado, " +
      "esperado = excluded.esperado WHERE arqueo.cerrada_en IS NULL;",
    reunionId,
    JSON.stringify(conteo),
    totalConteo(conteo),
    esperado,
  );
}

export async function guardarMotivo(base: BaseLocal, reunionId: string, motivo: string) {
  await base.correr("UPDATE arqueo SET motivo = ? WHERE reunion_id = ? AND cerrada_en IS NULL;", motivo.trim(), reunionId);
}

/** Correcciones de hoy (D9): la firma de cierre las ratifica. */
export async function correccionesDeHoy(base: BaseLocal, reunionId: string): Promise<Elemento[]> {
  return (await elementosDeLaReunion(base, reunionId)).filter((e) => e.tipo === "correccion");
}

/** Ids de movimiento del libro que cubre el cierre (el préstamo cuenta por su desembolso). */
export function movimientosDelCierre(elementos: Elemento[]): string[] {
  return elementos
    .filter((e) => !["reunion", "cierre", "llave_cargo"].includes(e.tipo))
    .map((e) => (e.tipo === "prestamo" ? String(e.datos.id_desembolso) : e.id));
}

const TIPOS_TOTALES = ["ahorro", "fondo_social", "multa", "venta", "desembolso", "abono", "faltante", "sobrante"] as const;

/**
 * Pesos por tipo de lo que lista el cierre (ET1); cada corrección resta en el tipo que corrige.
 * El servidor calcula lo mismo con libro.servicio.totales_por_tipo y compara.
 */
export function totalesDelCierre(elementos: Elemento[], ciclo: Ciclo): Record<string, number> {
  const totales: Record<string, number> = Object.fromEntries(TIPOS_TOTALES.map((t) => [t, 0]));
  const de = new Map<string, [string, number]>();
  for (const e of elementos) {
    const d = e.datos as Record<string, number | string>;
    let par: [string, number] | null = null;
    if (e.tipo === "ahorro") par = ["ahorro", Number(d.acciones) * ciclo.valor_accion];
    else if (e.tipo === "multa") par = ["multa", Number(d.cantidad) * ciclo.valor_multa];
    else if (e.tipo === "abono") par = ["abono", Number(d.monto)];
    else if (e.tipo === "prestamo") par = ["desembolso", Number(d.capital)];
    else if (e.tipo === "movimiento") par = [String(d.tipo), Number(d.monto)];
    else if (e.tipo === "correccion") {
      const original = de.get(String(d.original));
      if (original) par = [original[0], -original[1]];
    }
    if (!par) continue;
    de.set(e.id, par);
    if (par[0] in totales) totales[par[0]] += par[1];
  }
  return totales;
}

/**
 * Cierra la reunión: si la caja no cuadra, registra el faltante o sobrante con su motivo, y
 * firma el cierre con la lista de movimientos, la caja contada, los totales y el resumen (ET1). Todo con las mismas N firmas,
 * en una sola transacción: nunca un cierre a medias.
 */
export async function cerrarReunion(
  base: BaseLocal,
  cripto: Cripto,
  datos: { reunion: ReunionLocal; firmantes: FirmanteCargo[]; foto: FotoGrupo; ahora: Date },
): Promise<void> {
  const arqueo = await arqueoGuardado(base, datos.reunion.id);
  if (!arqueo) throw new ReglaInvalida("FALTA_ARQUEO");
  if (arqueo.cerradaEn) return;
  if (datos.firmantes.length < FIRMAS_PRESTAMO) throw new ReglaInvalida("FIRMAS_INSUFICIENTES");
  datos.firmantes.forEach((f, i) => {
    if (puedeFirmar(f.perfil, datos.firmantes.slice(0, i).map((x) => x.perfil), [], datos.foto)) {
      throw new ReglaInvalida("FIRMA_NO_VALIDA");
    }
  });
  const diferencia = arqueo.contado - arqueo.esperado;
  if (diferencia !== 0 && !arqueo.motivo) throw new ReglaInvalida("FALTA_MOTIVO");

  const nuevos: Elemento[] = [];
  if (diferencia !== 0) {
    const tipo = diferencia < 0 ? "faltante" : "sobrante";
    nuevos.push(
      await prepararElemento(
        cripto,
        {
          id: await idNatural(cripto, tipo, datos.reunion.id),
          tipo: "movimiento",
          datos: { reunion: datos.reunion.id, tipo, monto: Math.abs(diferencia), detalle: { motivo: arqueo.motivo } },
        },
        datos.firmantes,
      ),
    );
  }
  const delCierre = [...(await elementosDeLaReunion(base, datos.reunion.id)), ...nuevos];
  const lista = movimientosDelCierre(delCierre);
  // Instantánea del resumen que se lee en voz alta (D27, ET1): cifras por titular seudónimo.
  const resumen = [];
  for (const m of datos.foto.miembros.filter((x) => x.activo)) {
    const r = await resumenMiembro(base, datos.reunion, datos.foto, m);
    resumen.push({
      titular: m.titular_id,
      ahorro_hoy: r.ahorroHoy,
      ahorro_ciclo: r.ahorroCiclo,
      ...(r.debePrestamo === null ? {} : { debe_prestamo: r.debePrestamo }),
    });
  }
  nuevos.push(
    await prepararElemento(
      cripto,
      {
        id: await idNatural(cripto, "cierre", datos.reunion.id),
        tipo: "cierre",
        datos: {
          reunion: datos.reunion.id,
          movimientos: lista,
          caja_contada: arqueo.contado,
          totales: totalesDelCierre(delCierre, datos.foto.ciclo!),
          resumen,
        },
      },
      datos.firmantes,
    ),
  );
  await base.transaccion(async (txn) => {
    for (const e of nuevos) await encolar(txn, e, datos.ahora);
    await txn.correr("UPDATE arqueo SET cerrada_en = ? WHERE reunion_id = ?;", datos.ahora.toISOString(), datos.reunion.id);
  });
}

/** Termina la reunión después del resumen: queda cerrada en este celular. */
export async function terminarReunion(base: BaseLocal, reunionId: string) {
  await base.correr("UPDATE reunion_local SET estado = 'cerrada', paso = 9 WHERE id = ?;", reunionId);
}

// --- resumen por miembro (D27) ---------------------------------------------------------------

export interface ResumenMiembro {
  ahorroHoy: number;
  ahorroCiclo: number;
  debePrestamo: number | null;
}

export async function resumenMiembro(
  base: BaseLocal,
  reunion: ReunionLocal,
  foto: FotoGrupo,
  miembro: MiembroFoto,
): Promise<ResumenMiembro> {
  const ciclo = foto.ciclo!;
  const aportes = await aportesRegistrados(base, reunion.id, miembro.titular_id);
  const ahorroHoy = aportes ? montos(ciclo, aportes).ahorro : 0;
  const elementos = await elementosDeLaReunion(base, reunion.id);
  let debe: number | null = null;
  for (const p of foto.prestamos.filter((x) => x.titular_id === miembro.titular_id)) {
    const abonos = new Set(elementos.filter((e) => e.tipo === "abono" && e.datos.prestamo === p.id).map((e) => e.id));
    const delPrestamo = elementos.filter(
      (e) => abonos.has(e.id) || (e.tipo === "correccion" && abonos.has(String(e.datos.original))),
    );
    debe = (debe ?? 0) + p.saldo - efectoEnCaja(delPrestamo, ciclo);
  }
  for (const e of elementos.filter((x) => x.tipo === "prestamo" && x.datos.titular === miembro.titular_id)) {
    debe = (debe ?? 0) + planDeCuotas(ciclo, Number(e.datos.capital), Number(e.datos.num_cuotas)).total_pagar;
  }
  return { ahorroHoy, ahorroCiclo: miembro.ahorro_ciclo + ahorroHoy, debePrestamo: debe };
}
