// La reunión en el celular (TX6a): abrir, asistencia, aportes por miembro y posición del
// asistente. Todo lo que va al libro sale como elemento firmado a la cola (TX5); aquí solo
// se guarda lo necesario para llevar y retomar la reunión.
//
//   abrirReunion ──► elemento "reunion" + reunion_local(paso 1)
//   registrarAportes(miembro) ──► ahorro / fondo social / multas (ids v5 por clave natural)
//                                 └─ si ya había registro distinto: corrección de cada uno (D9)

import { montosRegistro } from "@credimpacto/reglas";

import { encolar, prepararElemento, type Elemento, type Firmante } from "../cola/cola";
import type { FotoGrupo, MiembroFoto } from "../cola/grupo";
import { idNatural } from "../cola/ids";
import type { BaseLocal } from "../datos/base";
import type { Cripto } from "../seguridad/cripto";

export const TOTAL_PASOS = 9;

/** Títulos cortos de los 9 pasos (D1 de diseño). */
export const PASOS = [
  "Abrir reunión",
  "Cambios desde la última",
  "Asistencia",
  "Aportes",
  "Abonos",
  "Préstamos",
  "Arqueo",
  "Cierre y firmas",
  "Resumen",
] as const;

export type Ciclo = NonNullable<FotoGrupo["ciclo"]>;

export interface ReunionLocal {
  id: string;
  ciclo_id: string;
  numero: number;
  fecha: string;
  abierta_por: string;
  paso: number;
  miembro: number;
  estado: "abierta" | "cerrada";
}

/** Motivos de multa del catálogo (D11). El monto es el valor de multa del ciclo. */
export const MOTIVOS_MULTA = [
  { id: "tarde", texto: "Llegó tarde" },
  { id: "no_asistio", texto: "No asistió" },
] as const;
export type MotivoMulta = (typeof MOTIVOS_MULTA)[number]["id"];

export interface Aportes {
  acciones: number;
  fondoSocial: boolean;
  multas: Partial<Record<MotivoMulta, number>>;
}

export const SIN_APORTES: Aportes = { acciones: 0, fondoSocial: true, multas: {} };

export class ReunionYaAbierta extends Error {
  constructor() {
    super("Ya hay una reunión abierta en este celular.");
  }
}

export async function reunionAbierta(base: BaseLocal): Promise<ReunionLocal | null> {
  return base.primera<ReunionLocal>("SELECT * FROM reunion_local WHERE estado = 'abierta';");
}

/** Número de la siguiente reunión del ciclo según lo bajado y lo abierto aquí. */
export async function siguienteNumero(base: BaseLocal, foto: Pick<FotoGrupo, "reuniones">, cicloId: string) {
  const local = await base.primera<{ n: number | null }>(
    "SELECT max(numero) AS n FROM reunion_local WHERE ciclo_id = ?;",
    cicloId,
  );
  const delServidor = Math.max(0, ...foto.reuniones.map((r) => r.numero));
  return Math.max(delServidor, local?.n ?? 0) + 1;
}

export async function abrirReunion(
  base: BaseLocal,
  cripto: Cripto,
  datos: { ciclo: Ciclo; numero: number; fecha: string; escritor: Firmante; id: string; ahora: Date },
): Promise<ReunionLocal> {
  if (await reunionAbierta(base)) throw new ReunionYaAbierta();
  const elemento = await prepararElemento(
    cripto,
    { id: datos.id, tipo: "reunion", datos: { ciclo: datos.ciclo.id, numero: datos.numero, fecha: datos.fecha } },
    [datos.escritor],
  );
  await base.transaccion(async (txn) => {
    await encolar(txn, elemento, datos.ahora);
    await txn.correr(
      "INSERT INTO reunion_local (id, ciclo_id, numero, fecha, abierta_por) VALUES (?, ?, ?, ?, ?);",
      datos.id,
      datos.ciclo.id,
      datos.numero,
      datos.fecha,
      datos.escritor.llaveId,
    );
  });
  return (await reunionAbierta(base))!;
}

/** Guarda en qué paso y en qué miembro va la reunión (D14: retomar en el punto exacto). */
export async function guardarPosicion(base: BaseLocal, reunionId: string, paso: number, miembro = 0) {
  if (paso < 1 || paso > TOTAL_PASOS) throw new RangeError(`Paso fuera de rango: ${paso}`);
  await base.correr("UPDATE reunion_local SET paso = ?, miembro = ? WHERE id = ?;", paso, miembro, reunionId);
}

export async function marcarAsistencia(base: BaseLocal, reunionId: string, membresiaId: string, presente: boolean) {
  await base.correr(
    "INSERT INTO asistencia (reunion_id, membresia_id, presente) VALUES (?, ?, ?) " +
      "ON CONFLICT (reunion_id, membresia_id) DO UPDATE SET presente = excluded.presente;",
    reunionId,
    membresiaId,
    presente ? 1 : 0,
  );
}

export async function asistencia(base: BaseLocal, reunionId: string): Promise<Map<string, boolean>> {
  const filas = await base.todas<{ membresia_id: string; presente: number }>(
    "SELECT membresia_id, presente FROM asistencia WHERE reunion_id = ?;",
    reunionId,
  );
  return new Map(filas.map((f) => [f.membresia_id, f.presente === 1]));
}

/** Pesos de lo que aporta una persona hoy, con los precios del ciclo. */
export function montos(ciclo: Ciclo, aportes: Aportes) {
  const cantidadMultas = Object.values(aportes.multas).reduce((n, c) => n + (c ?? 0), 0);
  const { ahorro, multas } = montosRegistro({
    acciones: aportes.acciones,
    cantidad_multas: cantidadMultas,
    valor_accion: ciclo.valor_accion,
    valor_multa: ciclo.valor_multa,
    max_acciones: ciclo.max_acciones_reunion,
  });
  const fondoSocial = aportes.fondoSocial ? ciclo.valor_fondo_social : 0;
  return { ahorro, fondoSocial, multas, total: ahorro + fondoSocial + multas };
}

interface Registrado {
  version: number;
  acciones: number;
  fondo_social: number;
  multas: string;
  elementos: string;
}

export async function aportesRegistrados(
  base: BaseLocal,
  reunionId: string,
  titularId: string,
): Promise<Aportes | null> {
  const fila = await base.primera<Registrado>(
    "SELECT * FROM registro_miembro WHERE reunion_id = ? AND titular_id = ?;",
    reunionId,
    titularId,
  );
  if (!fila) return null;
  return { acciones: fila.acciones, fondoSocial: fila.fondo_social === 1, multas: JSON.parse(fila.multas) };
}

/**
 * "Igual que la reunión pasada" (D11): las acciones y el fondo social que dio el miembro en la
 * última reunión del ciclo. Vale la más reciente entre la que llevó este celular y la que conoce
 * la Fundación. Las multas no se copian: dependen de lo que pase hoy. null si no dio nada.
 */
export async function aportesDeLaPasada(
  base: BaseLocal,
  foto: Pick<FotoGrupo, "ciclo" | "ultima_reunion">,
  reunionId: string,
  titularId: string,
): Promise<Aportes | null> {
  const local = await base.primera<{ numero: number; acciones: number; fondo_social: number }>(
    "SELECT l.numero, r.acciones, r.fondo_social FROM registro_miembro r " +
      "JOIN reunion_local l ON l.id = r.reunion_id " +
      "WHERE r.titular_id = ? AND r.reunion_id <> ? AND l.ciclo_id = ? ORDER BY l.numero DESC LIMIT 1;",
    titularId,
    reunionId,
    foto.ciclo?.id ?? "",
  );
  const servidor = foto.ultima_reunion;
  let pasada: { acciones: number; fondoSocial: boolean } | null = null;
  if (local && (!servidor || local.numero >= servidor.numero)) {
    pasada = { acciones: local.acciones, fondoSocial: local.fondo_social === 1 };
  } else if (servidor) {
    const dio = servidor.aportes[titularId];
    pasada = dio ? { acciones: dio.acciones, fondoSocial: dio.fondo_social } : null;
  }
  if (!pasada || (pasada.acciones === 0 && !pasada.fondoSocial)) return null;
  const tope = foto.ciclo?.max_acciones_reunion ?? pasada.acciones;
  return { acciones: Math.min(pasada.acciones, tope), fondoSocial: pasada.fondoSocial, multas: {} };
}

export const iguales = (a: Aportes, b: Aportes) =>
  a.acciones === b.acciones &&
  a.fondoSocial === b.fondoSocial &&
  MOTIVOS_MULTA.every((m) => (a.multas[m.id] ?? 0) === (b.multas[m.id] ?? 0));

/**
 * Guarda los aportes de un miembro: un elemento por concepto, firmado por quien opera. Si ya
 * había un registro distinto, primero corrige cada elemento anterior (contramovimiento, D9) y
 * después registra la versión nueva con ids nuevos. Volver a guardar lo mismo no hace nada.
 */
export async function registrarAportes(
  base: BaseLocal,
  cripto: Cripto,
  datos: {
    reunion: ReunionLocal;
    ciclo: Ciclo;
    miembro: MiembroFoto;
    aportes: Aportes;
    firmante: Firmante;
    ahora: Date;
  },
): Promise<void> {
  const { reunion, miembro, aportes, firmante } = datos;
  montos(datos.ciclo, aportes); // valida el tope de acciones antes de firmar nada
  const previo = await base.primera<Registrado>(
    "SELECT * FROM registro_miembro WHERE reunion_id = ? AND titular_id = ?;",
    reunion.id,
    miembro.titular_id,
  );
  if (previo && iguales(await aportesRegistrados(base, reunion.id, miembro.titular_id) as Aportes, aportes)) return;
  const version = previo ? previo.version + 1 : 1;
  const clave = (tipo: string, ...mas: string[]) =>
    idNatural(cripto, tipo, reunion.id, miembro.titular_id, String(version), ...mas);

  const elementos: Elemento[] = [];
  const firmar = async (id: string, tipo: Elemento["tipo"], d: Elemento["datos"]) =>
    elementos.push(await prepararElemento(cripto, { id, tipo, datos: d }, [firmante]));

  for (const original of previo ? (JSON.parse(previo.elementos) as string[]) : []) {
    await firmar(await idNatural(cripto, "correccion", original), "correccion", {
      original,
      motivo: "Corregido en la reunión",
    });
  }
  const nuevos: string[] = [];
  if (aportes.acciones > 0) {
    const id = await clave("ahorro");
    nuevos.push(id);
    await firmar(id, "ahorro", { reunion: reunion.id, titular: miembro.titular_id, acciones: aportes.acciones });
  }
  if (aportes.fondoSocial) {
    const id = await clave("fondo_social");
    nuevos.push(id);
    await firmar(id, "movimiento", {
      reunion: reunion.id,
      tipo: "fondo_social",
      monto: datos.ciclo.valor_fondo_social,
      titular: miembro.titular_id,
    });
  }
  for (const motivo of MOTIVOS_MULTA) {
    const cantidad = aportes.multas[motivo.id] ?? 0;
    if (cantidad <= 0) continue;
    const id = await clave("multa", motivo.id);
    nuevos.push(id);
    await firmar(id, "multa", { reunion: reunion.id, titular: miembro.titular_id, cantidad, motivo: motivo.texto });
  }

  await base.transaccion(async (txn) => {
    for (const e of elementos) await encolar(txn, e, datos.ahora);
    await txn.correr(
      "INSERT INTO registro_miembro (reunion_id, titular_id, version, acciones, fondo_social, multas, elementos) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (reunion_id, titular_id) DO UPDATE SET " +
        "version = excluded.version, acciones = excluded.acciones, fondo_social = excluded.fondo_social, " +
        "multas = excluded.multas, elementos = excluded.elementos;",
      reunion.id,
      miembro.titular_id,
      version,
      aportes.acciones,
      aportes.fondoSocial ? 1 : 0,
      JSON.stringify(aportes.multas),
      JSON.stringify(nuevos),
    );
  });
}

/** Cuántos elementos esperan subir a la Fundación (la franja de arriba, D5). */
export async function porSubir(base: BaseLocal): Promise<number> {
  return (await base.primera<{ n: number }>("SELECT count(*) AS n FROM pendientes WHERE estado = 'pendiente';"))?.n ?? 0;
}
