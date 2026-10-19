// Cola propia de envío sobre la base cifrada (TX5, EX5).
//
//   registrar ──firmar (cargo)──► encolar ──► pendientes (SQLite cifrada)
//   sincronizar: lotes de 50 en orden ──firmar (celular)──► POST /api/sync/lotes
//                └─► cada resultado se guarda al llegar; un corte de señal deja el resto
//                    pendiente y la próxima vez se reanuda desde ahí (el servidor no duplica).
//
// Contrato de subida: formato 1 (backend/sync/servicio.py). Nunca se cambia un formato
// publicado; uno nuevo se agrega y el servidor sigue aceptando los viejos (N5).

import { canonico, type ValorJson } from "@credimpacto/reglas";

import type { BaseLocal } from "../datos/base";
import { firmar } from "../seguridad/firma";
import type { Cripto } from "../seguridad/cripto";

export const FORMATO = 1;
export const TAMANO_LOTE = 50;

export type TipoElemento =
  | "reunion"
  | "ahorro"
  | "multa"
  | "movimiento"
  | "prestamo"
  | "abono"
  | "correccion"
  | "llave_cargo"
  | "cierre"
  | "llave_socio";

export interface Firma {
  llave: string;
  firma: string;
}

export interface Elemento {
  id: string;
  tipo: TipoElemento;
  datos: { [clave: string]: ValorJson };
  firmas: Firma[];
}

export interface Firmante {
  llaveId: string;
  privada: CryptoKey;
}

export type EstadoServidor = "confirmado" | "por_validar" | "rechazado" | "en_conflicto" | "en_espera";

export interface ResultadoElemento {
  id: string;
  estado: EstadoServidor;
  codigo: string;
}

export class RecapturaDistinta extends Error {
  constructor(readonly id: string) {
    super("Ya hay un registro distinto con ese mismo id.");
  }
}

export class SinSenal extends Error {
  constructor() {
    super("Sin señal");
  }
}

export class CelularRechazado extends Error {
  constructor() {
    super("El servidor no reconoce este celular.");
  }
}

/** Lo que firma cada cargo: igual que `lo_firmado` del servidor. */
export const loFirmado = (e: Pick<Elemento, "id" | "tipo" | "datos">): ValorJson => ({
  formato: FORMATO,
  id: e.id,
  tipo: e.tipo,
  datos: e.datos,
});

/** Firma el elemento con los cargos; el primero es quien lo registra. */
export async function prepararElemento(
  cripto: Cripto,
  e: Pick<Elemento, "id" | "tipo" | "datos">,
  firmantes: Firmante[],
): Promise<Elemento> {
  if (firmantes.length === 0) throw new Error("Todo registro lleva la firma de un cargo.");
  const firmas: Firma[] = [];
  for (const f of firmantes) firmas.push({ llave: f.llaveId, firma: await firmar(cripto, f.privada, loFirmado(e)) });
  return { ...e, firmas };
}

/** Guarda el elemento para enviarlo. Un doble toque (mismo contenido) no lo duplica. */
export async function encolar(base: BaseLocal, elemento: Elemento, ahora: Date): Promise<void> {
  const carga = canonico(elemento as unknown as ValorJson);
  const previo = await base.primera<{ carga: string }>("SELECT carga FROM pendientes WHERE id = ?;", elemento.id);
  if (previo) {
    if (previo.carga === carga) return;
    throw new RecapturaDistinta(elemento.id);
  }
  await base.correr(
    "INSERT INTO pendientes (id, tipo, carga, creado_en) VALUES (?, ?, ?, ?);",
    elemento.id,
    elemento.tipo,
    carga,
    ahora.toISOString(),
  );
}

interface FilaPendiente {
  orden: number;
  id: string;
  carga: string;
}

async function siguienteLote(base: BaseLocal, despuesDe: number, tamano: number) {
  return base.todas<FilaPendiente>(
    "SELECT rowid AS orden, id, carga FROM pendientes " +
      "WHERE estado = 'pendiente' AND rowid > ? ORDER BY rowid LIMIT ?;",
    despuesDe,
    tamano,
  );
}

const ESTADO_LOCAL: Record<EstadoServidor, string> = {
  confirmado: "confirmado",
  por_validar: "por_validar",
  rechazado: "rechazado",
  en_conflicto: "en_conflicto",
  en_espera: "pendiente", // falta algo que llega después: se reenvía en la próxima vuelta
};

async function guardarResultados(base: BaseLocal, resultados: ResultadoElemento[]) {
  await base.transaccion(async (txn) => {
    for (const r of resultados) {
      await txn.correr(
        "UPDATE pendientes SET estado = ?, codigo = ? WHERE id = ? AND estado = 'pendiente';",
        ESTADO_LOCAL[r.estado] ?? "pendiente",
        r.codigo,
        r.id,
      );
    }
  });
}

export type EnviarLote = (cuerpo: { formato: number; lote: string; elementos: Elemento[] }) => Promise<ResultadoElemento[]>;

export interface Resumen {
  enviados: number;
  porEstado: Record<EstadoServidor, number>;
  /** "listo" si recorrió toda la cola; "sin_senal" si se cortó (se reanuda la próxima vez). */
  fin: "listo" | "sin_senal";
}

/**
 * Envía todo lo pendiente en lotes de 50, en el orden en que se registró. Recorre la cola una
 * vez con un cursor: lo que queda en espera no tapa lo que viene detrás.
 */
export async function sincronizar(
  base: BaseLocal,
  enviar: EnviarLote,
  nuevoId: () => string,
  tamano = TAMANO_LOTE,
): Promise<Resumen> {
  const resumen: Resumen = {
    enviados: 0,
    porEstado: { confirmado: 0, por_validar: 0, rechazado: 0, en_conflicto: 0, en_espera: 0 },
    fin: "listo",
  };
  let cursor = 0;
  for (;;) {
    const filas = await siguienteLote(base, cursor, tamano);
    if (filas.length === 0) return resumen;
    let resultados: ResultadoElemento[];
    try {
      resultados = await enviar({
        formato: FORMATO,
        lote: nuevoId(),
        elementos: filas.map((f) => JSON.parse(f.carga) as Elemento),
      });
    } catch (error) {
      if (error instanceof SinSenal) return { ...resumen, fin: "sin_senal" };
      throw error;
    }
    await guardarResultados(base, resultados);
    for (const r of resultados) resumen.porEstado[r.estado] = (resumen.porEstado[r.estado] ?? 0) + 1;
    resumen.enviados += filas.length;
    cursor = filas[filas.length - 1].orden;
  }
}

/** Cliente HTTP del lote: el cuerpo va firmado con la llave del celular. */
export function enviarPorHttp(opciones: {
  servidor: string;
  dispositivoId: string;
  firmarCuerpo: (cuerpo: ValorJson) => Promise<string>;
  pedir?: typeof fetch;
}): EnviarLote {
  const pedir = opciones.pedir ?? fetch;
  return async (cuerpo) => {
    const valor = cuerpo as unknown as ValorJson;
    const firma = await opciones.firmarCuerpo(valor);
    let respuesta: Response;
    try {
      respuesta = await pedir(`${opciones.servidor}/api/sync/lotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Credimpacto-Dispositivo": opciones.dispositivoId,
          "X-Credimpacto-Firma": firma,
        },
        body: canonico(valor),
      });
    } catch {
      throw new SinSenal();
    }
    if (respuesta.status === 401) throw new CelularRechazado();
    if (respuesta.status >= 500) throw new SinSenal(); // el servidor falló: se reintenta después
    if (!respuesta.ok) throw new Error(`El servidor no aceptó el lote (${respuesta.status}).`);
    return ((await respuesta.json()) as { resultados: ResultadoElemento[] }).resultados;
  };
}
