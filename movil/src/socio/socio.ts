// Acceso del socio y su vista de solo lectura en el celular (TX8, TD5: EX4, N2, N3, N7, N7a, N17).
//
//   alta (después del cierre, nunca en los 9 pasos): un cargo elige al socio y firma el alta; el
//   socio crea su PIN dos veces. Su llave sube por la cola (llave_socio).
//   almacén: un archivo SQLCipher propio por socio, con llave aleatoria envuelta por su PIN y el
//   secreto del Keystore. El PIN de un socio nunca abre la base de la reunión (N17).
//   PIN equivocado: tras 5 errores, espera de 1, 2, 4… hasta 60 minutos; nunca bloqueo total (N7).

import { canonico, type ValorJson } from "@credimpacto/reglas";

import { encolar, prepararElemento, type Firmante } from "../cola/cola";
import type { FotoGrupo } from "../cola/grupo";
import type { BaseLocal } from "../datos/base";
import type { AlmacenSeguro } from "../seguridad/almacen";
import type { Cripto } from "../seguridad/cripto";
import { secretoDelDispositivo } from "../seguridad/dispositivo";
import { firmar } from "../seguridad/firma";
import { abrirCargo, altaCargo, crearDek, PinIncorrecto, type EntradaCargo } from "../seguridad/llavero";
import { calibrar } from "../seguridad/pin";

// --- perfiles de socio en este celular ------------------------------------------------------

export interface PerfilSocio {
  llaveId: string;
  membresiaId: string;
  numero: number;
}

const INDICE = "socios.indice";
const LLAVERO = (llaveId: string) => `socio.${llaveId}`;
const ESPERA = (llaveId: string) => `socio.espera.${llaveId}`;
export const nombreBaseSocio = (llaveId: string) => `socio-${llaveId}.db`;

export async function perfilesSocio(almacen: AlmacenSeguro): Promise<PerfilSocio[]> {
  const texto = await almacen.leer(INDICE);
  return texto ? (JSON.parse(texto) as PerfilSocio[]) : [];
}

async function guardarPerfilSocio(almacen: AlmacenSeguro, perfil: PerfilSocio, llavero: EntradaCargo) {
  await almacen.escribir(LLAVERO(perfil.llaveId), JSON.stringify(llavero));
  const lista = (await perfilesSocio(almacen)).filter((p) => p.membresiaId !== perfil.membresiaId);
  await almacen.escribir(INDICE, JSON.stringify([...lista, perfil]));
}

// --- espera creciente (N7) ------------------------------------------------------------------

export const INTENTOS_POR_TANDA = 5;
export const ESPERA_MAXIMA_MIN = 60;

interface EstadoEspera {
  fallos: number;
  tandas: number;
  hasta: number;
}

export class EsperaSocio extends Error {
  constructor(readonly minutos: number) {
    super(minutos <= 1 ? "Espere 1 minuto para intentar de nuevo." : `Espere ${minutos} minutos para intentar de nuevo.`);
  }
}

export class PinSocioFallido extends Error {
  constructor(readonly restantes: number) {
    super(`PIN no coincide · quedan ${restantes} intentos`);
  }
}

async function leerEspera(almacen: AlmacenSeguro, llaveId: string): Promise<EstadoEspera> {
  const texto = await almacen.leer(ESPERA(llaveId));
  return texto ? (JSON.parse(texto) as EstadoEspera) : { fallos: 0, tandas: 0, hasta: 0 };
}

/** Prueba el PIN del socio respetando la espera; el intento se cuenta antes de probar. */
export async function intentarSocio<T>(
  almacen: AlmacenSeguro,
  llaveId: string,
  ahora: () => Date,
  probar: () => Promise<T>,
): Promise<T> {
  const estado = await leerEspera(almacen, llaveId);
  const restanteMs = estado.hasta - ahora().getTime();
  if (restanteMs > 0) throw new EsperaSocio(Math.ceil(restanteMs / 60_000));
  const conEste = { ...estado, fallos: estado.fallos + 1 };
  await almacen.escribir(ESPERA(llaveId), JSON.stringify(conEste));
  try {
    const resultado = await probar();
    await almacen.escribir(ESPERA(llaveId), JSON.stringify({ fallos: 0, tandas: 0, hasta: 0 }));
    return resultado;
  } catch (error) {
    if (!(error instanceof PinIncorrecto)) {
      await almacen.escribir(ESPERA(llaveId), JSON.stringify(estado));
      throw error;
    }
    if (conEste.fallos < INTENTOS_POR_TANDA) throw new PinSocioFallido(INTENTOS_POR_TANDA - conEste.fallos);
    const minutos = Math.min(2 ** conEste.tandas, ESPERA_MAXIMA_MIN);
    const siguiente = { fallos: 0, tandas: conEste.tandas + 1, hasta: ahora().getTime() + minutos * 60_000 };
    await almacen.escribir(ESPERA(llaveId), JSON.stringify(siguiente));
    throw new EsperaSocio(minutos);
  }
}

// --- almacén propio del socio (N17) -----------------------------------------------------------

export interface DatosSocio {
  numero: number;
  datos_hasta: string | null;
  ahorrado_ciclo: number;
  aportes: { fecha: string; acciones: number; pesos: number; estado: "confirmado" | "guardado" }[];
  prestamo: { me_falta_pagar: number; cuota: number; num_cuotas: number } | null;
  /** Cuándo llegó esto al celular (para los avisos de 30 y 60 días, N3). */
  actualizado_en: string;
}

export async function prepararBaseSocio(base: BaseLocal) {
  await base.ejecutar("CREATE TABLE IF NOT EXISTS datos (clave TEXT PRIMARY KEY, valor TEXT NOT NULL) STRICT;");
}

export async function guardarDatosSocio(base: BaseLocal, datos: DatosSocio) {
  await prepararBaseSocio(base);
  await base.correr(
    "INSERT INTO datos (clave, valor) VALUES ('socio', ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor;",
    JSON.stringify(datos),
  );
}

export async function leerDatosSocio(base: BaseLocal): Promise<DatosSocio | null> {
  await prepararBaseSocio(base);
  const fila = await base.primera<{ valor: string }>("SELECT valor FROM datos WHERE clave = 'socio';");
  return fila ? (JSON.parse(fila.valor) as DatosSocio) : null;
}

/** Lo que se muestra según la edad de los datos (N3): normal, aviso a los 30, sin cifras a los 60. */
export function vigenciaDatos(datos: DatosSocio, ahora: Date): { dias: number; aviso: "ninguno" | "viejos" | "caducados" } {
  const dias = Math.floor((ahora.getTime() - Date.parse(datos.actualizado_en)) / 86_400_000);
  return { dias, aviso: dias >= 60 ? "caducados" : dias > 30 ? "viejos" : "ninguno" };
}

// --- alta del socio (N7a) ---------------------------------------------------------------------

export function mensajeAltaSocio(d: { llaveId: string; membresiaId: string; dispositivoId: string; llavePublica: string }): ValorJson {
  return {
    tipo: "alta_llave_socio",
    v: 1,
    llave: d.llaveId,
    membresia: d.membresiaId,
    dispositivo: d.dispositivoId,
    llave_publica: d.llavePublica,
  };
}

export async function altaSocio(
  deps: { cripto: Cripto; almacen: AlmacenSeguro; abrirBaseSocio: (nombre: string, dek: Uint8Array) => Promise<BaseLocal>; ahora: () => Date },
  datos: { base: BaseLocal; foto: FotoGrupo; cargo: Firmante; dispositivoId: string; membresiaId: string; pin: string },
): Promise<PerfilSocio> {
  const miembro = datos.foto.miembros.find((m) => m.membresia_id === datos.membresiaId);
  if (!miembro) throw new Error("Ese socio no está en el grupo.");
  const secreto = await secretoDelDispositivo(deps.cripto, deps.almacen);
  const dek = crearDek(deps.cripto);
  const llavero = await altaCargo(deps.cripto, {
    cargoId: `socio:${datos.membresiaId}`,
    pin: datos.pin,
    secreto,
    dek,
    params: await calibrar(deps.cripto),
  });
  const firmaAlta = await firmar(
    deps.cripto,
    datos.cargo.privada,
    mensajeAltaSocio({ llaveId: llavero.llaveId, membresiaId: datos.membresiaId, dispositivoId: datos.dispositivoId, llavePublica: llavero.llavePublica }),
  );
  const elemento = await prepararElemento(
    deps.cripto,
    {
      id: llavero.llaveId,
      tipo: "llave_socio",
      datos: { membresia: datos.membresiaId, llave_publica: llavero.llavePublica, firma_alta: firmaAlta },
    },
    [datos.cargo],
  );
  await encolar(datos.base, elemento, deps.ahora());
  // Su archivo empieza con lo que el celular ya sabe de él (sus propias cifras del grupo).
  const propio = await deps.abrirBaseSocio(nombreBaseSocio(llavero.llaveId), dek);
  const prestamo = datos.foto.prestamos.find((p) => p.titular_id === miembro.titular_id && p.saldo > 0);
  await guardarDatosSocio(propio, {
    numero: miembro.numero,
    datos_hasta: datos.foto.generado_en.slice(0, 10),
    ahorrado_ciclo: miembro.ahorro_ciclo,
    aportes: [],
    prestamo: prestamo ? { me_falta_pagar: prestamo.saldo, cuota: prestamo.cuota_mensual, num_cuotas: prestamo.num_cuotas } : null,
    actualizado_en: datos.foto.generado_en,
  });
  await propio.cerrar();
  dek.fill(0);
  const perfil = { llaveId: llavero.llaveId, membresiaId: datos.membresiaId, numero: miembro.numero };
  await guardarPerfilSocio(deps.almacen, perfil, llavero);
  return perfil;
}

export interface SesionSocio {
  perfil: PerfilSocio;
  base: BaseLocal;
  privada: CryptoKey;
}

/** Abre el almacén del socio con su PIN (con la espera de N7). */
export async function abrirSocio(
  deps: { cripto: Cripto; almacen: AlmacenSeguro; abrirBaseSocio: (nombre: string, dek: Uint8Array) => Promise<BaseLocal>; ahora: () => Date },
  perfil: PerfilSocio,
  pin: string,
): Promise<SesionSocio> {
  const texto = await deps.almacen.leer(LLAVERO(perfil.llaveId));
  if (!texto) throw new Error("Este socio no tiene acceso en este celular.");
  const llavero = JSON.parse(texto) as EntradaCargo;
  const secreto = await secretoDelDispositivo(deps.cripto, deps.almacen);
  const abierto = await intentarSocio(deps.almacen, perfil.llaveId, deps.ahora, () => abrirCargo(deps.cripto, llavero, pin, secreto));
  const base = await deps.abrirBaseSocio(nombreBaseSocio(perfil.llaveId), abierto.dek);
  abierto.dek.fill(0);
  return { perfil, base, privada: abierto.privada };
}

/** Con señal: pide al servidor solo los datos de este socio y los guarda en su almacén. */
export async function actualizarSocio(
  sesion: SesionSocio,
  deps: { cripto: Cripto; servidor: string; pedir?: typeof fetch; ahora: () => Date },
): Promise<DatosSocio> {
  const pedir = deps.pedir ?? fetch;
  const cabeceras = { "Content-Type": "application/json", "X-Credimpacto-Socio": sesion.perfil.llaveId };
  const r1 = await pedir(`${deps.servidor}/api/socio/reto`, { method: "POST", headers: cabeceras });
  if (!r1.ok) throw new Error(`El servidor respondió ${r1.status}.`);
  const { reto } = (await r1.json()) as { reto: string };
  const firma = await firmar(deps.cripto, sesion.privada, { pedido: "socio", reto });
  const r2 = await pedir(`${deps.servidor}/api/socio/datos`, { method: "POST", headers: cabeceras, body: canonico({ reto, firma }) });
  if (!r2.ok) throw new Error(`El servidor respondió ${r2.status}.`);
  const datos = { ...((await r2.json()) as Omit<DatosSocio, "actualizado_en">), actualizado_en: deps.ahora().toISOString() };
  await guardarDatosSocio(sesion.base, datos);
  return datos;
}
