// Registro del celular (D18): con el usuario y la clave que la Fundación creó para la ACAP, o
// con el código QR del facilitador.
//
// El QR trae solo el código. La dirección del servidor está fija en la app: un QR falso no
// puede mandar el celular a otro servidor.

export interface Registro {
  dispositivoId: string;
  acapId: string;
  acapNombre: string;
}

export type MotivoRechazo =
  | "clave_invalida"
  | "codigo_invalido"
  | "codigo_vencido"
  | "llave_invalida"
  | "qr_ajeno"
  | "sin_senal"
  | "demasiados_intentos"
  | "servidor";

/** Textos de la tabla de estados nativos (revisión de diseño nativo, pasada 2). */
export const TEXTO_RECHAZO: Record<MotivoRechazo, string> = {
  clave_invalida: "El usuario o la clave no son correctos. Revíselos con la Fundación.",
  codigo_invalido: "El registro venció. Escriba otra vez el usuario y la clave de la ACAP.",
  codigo_vencido: "El registro venció. Escriba otra vez el usuario y la clave de la ACAP.",
  llave_invalida: "No se pudo registrar este celular. Intente de nuevo.",
  qr_ajeno: "Este código no es de Credimpacto.",
  sin_senal: "Necesita señal solo para este paso.",
  demasiados_intentos: "Demasiados intentos. Espere un minuto y vuelva a intentar.",
  servidor: "No se pudo registrar este celular. Intente de nuevo.",
};

export class EnrolamientoFallido extends Error {
  constructor(readonly motivo: MotivoRechazo) {
    super(TEXTO_RECHAZO[motivo]);
  }
}

const PREFIJO = "credimpacto:enrolar:";

/** El back-office pinta el QR con el texto `credimpacto:enrolar:<código>`. */
export function leerQr(texto: string): string {
  const limpio = texto.trim();
  const codigo = limpio.startsWith(PREFIJO) ? limpio.slice(PREFIJO.length) : "";
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(codigo)) throw new EnrolamientoFallido("qr_ajeno");
  return codigo;
}

export async function canjearCodigo(
  servidor: string,
  codigo: string,
  llavePublica: string,
  pedir: typeof fetch = fetch,
): Promise<Registro> {
  let respuesta: Response;
  try {
    respuesta = await pedir(`${servidor}/api/enrolamiento/canjear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, llave_publica: llavePublica }),
    });
  } catch {
    throw new EnrolamientoFallido("sin_senal");
  }
  if (respuesta.status === 400) {
    const { motivo } = (await respuesta.json()) as { motivo: string };
    throw new EnrolamientoFallido(motivo in TEXTO_RECHAZO ? (motivo as MotivoRechazo) : "servidor");
  }
  if (!respuesta.ok) throw new EnrolamientoFallido("servidor");
  const datos = (await respuesta.json()) as { dispositivo_id: string; acap_id: string; acap_nombre: string };
  return { dispositivoId: datos.dispositivo_id, acapId: datos.acap_id, acapNombre: datos.acap_nombre };
}

async function leerRespuesta<T>(pedido: () => Promise<Response>): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await pedido();
  } catch {
    throw new EnrolamientoFallido("sin_senal");
  }
  if (respuesta.status === 400) {
    const { motivo } = (await respuesta.json()) as { motivo: string };
    throw new EnrolamientoFallido(motivo in TEXTO_RECHAZO ? (motivo as MotivoRechazo) : "servidor");
  }
  if (respuesta.status === 429) throw new EnrolamientoFallido("demasiados_intentos");
  if (!respuesta.ok) throw new EnrolamientoFallido("servidor");
  return (await respuesta.json()) as T;
}

/** Entrar con el usuario y la clave de la ACAP: registra el celular y trae el código de un uso. */
export async function entrarConClave(
  servidor: string,
  usuario: string,
  clave: string,
  llavePublica: string,
  pedir: typeof fetch = fetch,
): Promise<{ codigo: string; registro: Registro }> {
  const datos = await leerRespuesta<{ codigo: string; dispositivo_id: string; acap_id: string; acap_nombre: string }>(() =>
    pedir(`${servidor}/api/enrolamiento/entrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: usuario.trim(), clave, llave_publica: llavePublica }),
    }),
  );
  return {
    codigo: datos.codigo,
    registro: { dispositivoId: datos.dispositivo_id, acapId: datos.acap_id, acapNombre: datos.acap_nombre },
  };
}
