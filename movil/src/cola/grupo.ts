// Bajada de los datos del grupo y sincronización completa (TX6.0).
//
//   sincronizarTodo: 1) subir la cola  2) bajar el grupo  3) anotar la fecha de sincronización
//
// Primero se sube y después se baja: así un celular retirado (E3) entrega lo suyo antes de
// borrar sus datos. La foto reemplaza la copia anterior en una sola transacción.

import type { ValorJson } from "@credimpacto/reglas";

import type { BaseLocal } from "../datos/base";
import { registrarSincronizacion } from "../datos/caducidad";
import { CelularRechazado, SinSenal, sincronizar, type EnviarLote, type Resumen } from "./cola";

export interface MiembroFoto {
  membresia_id: string;
  titular_id: string;
  numero: number;
  activo: boolean;
  ahorro_ciclo: number;
  /** "Yuliana I." (D3), solo si autorizó sus datos (Ley 1581); si no, null y se muestra el número. */
  nombre_corto?: string | null;
}

export interface FotoGrupo {
  formato: 1;
  generado_en: string;
  acap: { id: string; nombre: string; quorum_porcentaje?: number; mayoria?: string };
  ciclo: {
    id: string;
    numero: number;
    fecha_inicio: string;
    duracion_meses: number;
    valor_accion: number;
    max_acciones_reunion: number;
    valor_fondo_social: number;
    valor_multa: number;
    tasa_interes: string;
  } | null;
  miembros: MiembroFoto[];
  cargos: { id: string; tipo: string; membresia_id: string; llaves: string[] }[];
  reuniones: { id: string; numero: number; fecha: string; estado: string }[];
  prestamos: {
    id: string;
    titular_id: string;
    capital: number;
    num_cuotas: number;
    cuota_mensual: number;
    total_pagar: number;
    saldo: number;
  }[];
  /** Caja con que abre la próxima reunión: lo contado en el último arqueo (D12). */
  caja: number;
  /** Lo que dio cada titular en la última reunión del ciclo ("Igual que la reunión pasada", D11). */
  ultima_reunion?: UltimaReunion | null;
  /** Enlaces del comprobante confirmado de la última reunión cerrada, por titular (pregunta 2b). */
  comprobantes?: ComprobantesFoto | null;
  /** Propuestas del facilitador para el paso 2 "Cambios desde la última" (ET3, D7). */
  propuestas?: PropuestaFoto[];
}

export interface PropuestaFoto {
  id: string;
  accion: "anular" | "dejar";
  motivo: string;
  movimiento: { id: string; tipo: string; monto: number; titular_id: string | null; reunion: number; fecha: string };
}

export interface ComprobantesFoto {
  reunion: number;
  fecha: string;
  vence_en: string;
  enlaces: Record<string, string>;
}

export interface UltimaReunion {
  numero: number;
  aportes: Record<string, { acciones: number; fondo_social: boolean }>;
}

export class CelularRetirado extends Error {
  constructor() {
    super("Este celular fue retirado por la Fundación.");
  }
}

export type BajarGrupo = () => Promise<FotoGrupo>;

/** Cliente HTTP: pide un reto, lo firma con la llave del celular y baja la foto. */
export function bajarPorHttp(opciones: {
  servidor: string;
  dispositivoId: string;
  firmarComoDispositivo: (valor: ValorJson) => Promise<string>;
  pedir?: typeof fetch;
}): BajarGrupo {
  const pedir = opciones.pedir ?? fetch;
  const cabeceras = {
    "Content-Type": "application/json",
    "X-Credimpacto-Dispositivo": opciones.dispositivoId,
  };
  const llamar = async (ruta: string, cuerpo?: unknown) => {
    let respuesta: Response;
    try {
      respuesta = await pedir(`${opciones.servidor}${ruta}`, {
        method: "POST",
        headers: cabeceras,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
    } catch {
      throw new SinSenal();
    }
    if (respuesta.status === 410) throw new CelularRetirado();
    if (respuesta.status === 401) throw new CelularRechazado();
    if (respuesta.status >= 500) throw new SinSenal();
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`);
    return respuesta.json();
  };
  return async () => {
    const { reto } = (await llamar("/api/sync/reto")) as { reto: string };
    const firma = await opciones.firmarComoDispositivo({ pedido: "grupo", reto });
    return (await llamar("/api/sync/grupo", { reto, firma })) as FotoGrupo;
  };
}

/** Reemplaza la copia del servidor por la foto nueva. Los pendientes no se tocan. */
export async function guardarFoto(base: BaseLocal, foto: FotoGrupo): Promise<void> {
  await base.transaccion(async (txn) => {
    await txn.ejecutar("DELETE FROM grupo; DELETE FROM miembros;");
    const partes: [string, unknown][] = [
      ["acap", foto.acap],
      ["ciclo", foto.ciclo],
      ["cargos", foto.cargos],
      ["reuniones", foto.reuniones],
      ["prestamos", foto.prestamos],
      ["caja", foto.caja ?? 0],
      ["ultima_reunion", foto.ultima_reunion ?? null],
      ["comprobantes", foto.comprobantes ?? null],
      ["propuestas", foto.propuestas ?? []],
    ];
    for (const [id, datos] of partes) {
      await txn.correr(
        "INSERT INTO grupo (id, datos, descargado_en) VALUES (?, ?, ?);",
        id,
        JSON.stringify(datos),
        foto.generado_en,
      );
    }
    for (const m of foto.miembros) {
      await txn.correr(
        "INSERT INTO miembros (membresia_id, numero, iniciales, activo, titular_id, ahorro_ciclo) " +
          "VALUES (?, ?, ?, ?, ?, ?);",
        m.membresia_id,
        m.numero,
        m.nombre_corto ?? "",
        m.activo ? 1 : 0,
        m.titular_id,
        m.ahorro_ciclo,
      );
    }
  });
}

/** Lee una parte de la foto guardada (null si nunca se bajó o ya caducó). */
export async function leerParte<T>(base: BaseLocal, id: keyof FotoGrupo): Promise<T | null> {
  const fila = await base.primera<{ datos: string }>("SELECT datos FROM grupo WHERE id = ?;", id);
  return fila ? (JSON.parse(fila.datos) as T) : null;
}

export type ResultadoSincronizacion =
  | { fin: "listo"; subida: Resumen }
  | { fin: "sin_senal"; subida: Resumen | null }
  | { fin: "retirado"; subida: Resumen };

export async function sincronizarTodo(
  base: BaseLocal,
  dependencias: { enviar: EnviarLote; bajar: BajarGrupo; nuevoId: () => string; ahora: () => Date },
): Promise<ResultadoSincronizacion> {
  let subida: Resumen;
  try {
    subida = await sincronizar(base, dependencias.enviar, dependencias.nuevoId);
  } catch (error) {
    if (error instanceof SinSenal) return { fin: "sin_senal", subida: null };
    throw error;
  }
  if (subida.fin === "sin_senal") return { fin: "sin_senal", subida };
  try {
    await guardarFoto(base, await dependencias.bajar());
  } catch (error) {
    if (error instanceof CelularRetirado) return { fin: "retirado", subida };
    if (error instanceof SinSenal) return { fin: "sin_senal", subida };
    throw error;
  }
  await registrarSincronizacion(base, dependencias.ahora());
  return { fin: "listo", subida };
}
