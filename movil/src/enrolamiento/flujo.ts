// Registro del celular y alta de cargos (TD1, D18, D26).
//
//   usuario y clave de la ACAP (o QR) ──canjear──► celular registrado ──bajar el grupo──► base cifrada con DEK nueva
//      ──primer Presidente: su PIN envuelve la DEK; el servidor lo acepta autorizado por el
//        facilitador del QR, en los mismos 15 minutos
//   después, sin señal: el Presidente da de alta a los demás cargos (firma el alta, que sube
//   por la cola)
//
// Con señal solo el canje, la bajada y el primer Presidente. Si algo falla antes de guardar el
// perfil del Presidente, el celular queda como antes: se vuelve a leer un QR nuevo.

import type { ValorJson } from "@credimpacto/reglas";

import { encolar, prepararElemento } from "../cola/cola";
import { bajarPorHttp, guardarFoto, type FotoGrupo } from "../cola/grupo";
import type { BaseLocal } from "../datos/base";
import { registrarSincronizacion } from "../datos/caducidad";
import type { AlmacenSeguro } from "../seguridad/almacen";
import type { Cripto } from "../seguridad/cripto";
import { firmarComoDispositivo, llaveDelDispositivo, secretoDelDispositivo } from "../seguridad/dispositivo";
import { canjearCodigo, EnrolamientoFallido, entrarConClave, leerQr, type Registro } from "../seguridad/enrolamiento";
import { firmar, mensajeAlta } from "../seguridad/firma";
import { ControlIntentos } from "../seguridad/intentos";
import { abrirCargo, altaCargo, crearDek } from "../seguridad/llavero";
import { guardarPerfil, llaveroDe, type Perfil } from "../seguridad/perfiles";
import { calibrar, revisarPinNuevo, type PinRechazado } from "../seguridad/pin";

export interface Dependencias {
  cripto: Cripto;
  almacen: AlmacenSeguro;
  servidor: string;
  abrirBase: (dek: Uint8Array) => Promise<BaseLocal>;
  borrarBase: () => Promise<void>;
  pedir?: typeof fetch;
  ahora: () => Date;
}

const DISPOSITIVO_ID = "dispositivo.id";

export async function dispositivoRegistrado(almacen: AlmacenSeguro): Promise<string | null> {
  return almacen.leer(DISPOSITIVO_ID);
}

export const TEXTO_PIN_RECHAZADO: Record<PinRechazado, string> = {
  largo: "El PIN tiene 6 números.",
  repetido: "Ese PIN es fácil de adivinar. Use números distintos.",
  secuencia: "Ese PIN es fácil de adivinar. No use números seguidos.",
};

/** En curso: el celular ya está registrado y bajó el grupo; falta el primer Presidente. */
export interface EnrolamientoEnCurso {
  codigo: string;
  registro: Registro;
  base: BaseLocal;
  dek: Uint8Array;
  foto: FotoGrupo;
}

/** Paso 1: lee el QR, registra el celular y baja el grupo a una base cifrada nueva. */
export async function registrarCelular(deps: Dependencias, textoQr: string): Promise<EnrolamientoEnCurso> {
  if (!deps.servidor) throw new EnrolamientoFallido("servidor");
  const codigo = leerQr(textoQr);
  const llavePublica = await llaveDelDispositivo(deps.cripto, deps.almacen);
  const registro = await canjearCodigo(deps.servidor, codigo, llavePublica, deps.pedir);
  return bajarElGrupo(deps, codigo, registro);
}

/** Paso 1 sin QR: el usuario y la clave que la Fundación creó para la ACAP. */
export async function registrarConClave(deps: Dependencias, usuario: string, clave: string): Promise<EnrolamientoEnCurso> {
  if (!deps.servidor) throw new EnrolamientoFallido("servidor");
  const llavePublica = await llaveDelDispositivo(deps.cripto, deps.almacen);
  const { codigo, registro } = await entrarConClave(deps.servidor, usuario, clave, llavePublica, deps.pedir);
  return bajarElGrupo(deps, codigo, registro);
}

async function bajarElGrupo(deps: Dependencias, codigo: string, registro: Registro): Promise<EnrolamientoEnCurso> {
  await deps.almacen.escribir(DISPOSITIVO_ID, registro.dispositivoId);
  await deps.borrarBase(); // una base vieja de otro registro no sirve
  const dek = crearDek(deps.cripto);
  const base = await deps.abrirBase(dek);
  const bajar = bajarPorHttp({
    servidor: deps.servidor,
    dispositivoId: registro.dispositivoId,
    firmarComoDispositivo: (v) => firmarComoDispositivo(deps.cripto, deps.almacen, v),
    pedir: deps.pedir,
  });
  const foto = await bajar();
  await guardarFoto(base, foto);
  await registrarSincronizacion(base, deps.ahora());
  return { codigo, registro, base, dek, foto };
}

/** El cargo de Presidente del ciclo y el número de miembro de quien lo tiene. */
export function presidenteDe(foto: FotoGrupo): { cargoId: string; numero: number } | null {
  const cargo = foto.cargos.find((c) => c.tipo === "presidente");
  const numero = foto.miembros.find((m) => m.membresia_id === cargo?.membresia_id)?.numero;
  return cargo && numero !== undefined ? { cargoId: cargo.id, numero } : null;
}

/** Revisa el PIN nuevo y su confirmación (D26). Devuelve el texto del problema o null. */
export function revisarPinDoble(pin: string, confirmacion: string): string | null {
  const motivo = revisarPinNuevo(pin);
  if (motivo) return TEXTO_PIN_RECHAZADO[motivo];
  if (pin !== confirmacion) return "Los dos PIN no coinciden. Escríbalo otra vez.";
  return null;
}

/** Paso 2 (con señal): el primer Presidente crea su PIN y su llave; la autoriza el facilitador. */
export async function altaPrimerPresidente(
  deps: Dependencias,
  enCurso: EnrolamientoEnCurso,
  pin: string,
): Promise<Perfil> {
  const presidente = presidenteDe(enCurso.foto);
  if (!presidente) throw new Error("El ciclo no tiene Presidente. Avise al facilitador.");
  const secreto = await secretoDelDispositivo(deps.cripto, deps.almacen);
  const params = await calibrar(deps.cripto);
  const llavero = await altaCargo(deps.cripto, { cargoId: presidente.cargoId, pin, secreto, dek: enCurso.dek, params });
  const mensaje = {
    pedido: "primer_presidente",
    codigo: enCurso.codigo,
    llave: llavero.llaveId,
    cargo: presidente.cargoId,
    llave_publica: llavero.llavePublica,
  };
  const firma = await firmarComoDispositivo(deps.cripto, deps.almacen, mensaje);
  let respuesta: Response;
  try {
    respuesta = await (deps.pedir ?? fetch)(`${deps.servidor}/api/enrolamiento/presidente`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: enCurso.codigo,
        dispositivo_id: enCurso.registro.dispositivoId,
        llave_id: llavero.llaveId,
        cargo_id: presidente.cargoId,
        llave_publica: llavero.llavePublica,
        firma,
      }),
    });
  } catch {
    throw new EnrolamientoFallido("sin_senal");
  }
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { motivo?: string };
    throw new EnrolamientoFallido(cuerpo.motivo === "codigo_invalido" ? "codigo_invalido" : "servidor");
  }
  const perfil: Perfil = { cargoId: presidente.cargoId, tipo: "presidente", numero: presidente.numero };
  await guardarPerfil(deps.almacen, perfil, llavero);
  enCurso.dek.fill(0);
  return perfil;
}

/**
 * Sin señal: el Presidente (con su PIN) da de alta a otro cargo en este celular. El cargo nuevo
 * crea su PIN; su llave sube por la cola firmada por el Presidente (D18).
 */
export async function altaOtroCargo(
  deps: Pick<Dependencias, "cripto" | "almacen" | "ahora">,
  datos: {
    base: BaseLocal;
    foto: FotoGrupo;
    presidente: Perfil;
    pinPresidente: string;
    cargoId: string;
    pinNuevo: string;
    dispositivoId: string;
  },
): Promise<Perfil> {
  const cargo = datos.foto.cargos.find((c) => c.id === datos.cargoId);
  const numero = datos.foto.miembros.find((m) => m.membresia_id === cargo?.membresia_id)?.numero;
  if (!cargo || numero === undefined) throw new Error("Ese cargo no está en el ciclo.");
  const llaveroPresidente = await llaveroDe(deps.almacen, datos.presidente.cargoId);
  if (!llaveroPresidente) throw new Error("El Presidente no está registrado en este celular.");
  const secreto = await secretoDelDispositivo(deps.cripto, deps.almacen);
  const presidente = await new ControlIntentos(deps.almacen).intentar(datos.presidente.cargoId, () =>
    abrirCargo(deps.cripto, llaveroPresidente, datos.pinPresidente, secreto),
  );
  const llavero = await altaCargo(deps.cripto, {
    cargoId: cargo.id,
    pin: datos.pinNuevo,
    secreto,
    dek: presidente.dek,
    params: await calibrar(deps.cripto),
  });
  presidente.dek.fill(0);
  const firmaAlta = await firmar(
    deps.cripto,
    presidente.privada,
    mensajeAlta({ llaveId: llavero.llaveId, cargoId: cargo.id, dispositivoId: datos.dispositivoId, llavePublica: llavero.llavePublica }),
  );
  const elemento = await prepararElemento(
    deps.cripto,
    {
      id: llavero.llaveId,
      tipo: "llave_cargo",
      datos: {
        cargo: cargo.id,
        llave_publica: llavero.llavePublica,
        autoriza: llaveroPresidente.llaveId,
        firma_alta: firmaAlta,
      } as { [k: string]: ValorJson },
    },
    [{ llaveId: llaveroPresidente.llaveId, privada: presidente.privada }],
  );
  await encolar(datos.base, elemento, deps.ahora());
  const perfil: Perfil = { cargoId: cargo.id, tipo: cargo.tipo, numero };
  await guardarPerfil(deps.almacen, perfil, llavero);
  return perfil;
}
