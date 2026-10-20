// Cliente de la API para la oficina. /api se sirve en el mismo origen (rewrites de Next.js), así
// la cookie de sesión y la de CSRF son de este dominio; las peticiones que cambian algo llevan
// X-CSRFToken (Django).

export class SinSesion extends Error {}

function leerCookie(nombre: string): string {
  if (typeof document === "undefined") return "";
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${nombre}=`));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : "";
}

export async function api<T>(ruta: string, opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown } = {}): Promise<T> {
  const metodo = opciones.metodo ?? "GET";
  if (metodo !== "GET" && !leerCookie("csrftoken")) await fetch("/api/sesion/csrf", { credentials: "same-origin" });
  // Un FormData (fotos) va como multipart: el navegador pone el Content-Type con su separador.
  const formulario = opciones.cuerpo instanceof FormData;
  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    credentials: "same-origin",
    headers: {
      ...(formulario ? {} : { "Content-Type": "application/json" }),
      ...(metodo !== "GET" ? { "X-CSRFToken": leerCookie("csrftoken") } : {}),
    },
    body: opciones.cuerpo === undefined ? undefined : formulario ? (opciones.cuerpo as FormData) : JSON.stringify(opciones.cuerpo),
  });
  if (respuesta.status === 401) throw new SinSesion();
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error((datos as { mensaje?: string; detail?: string }).mensaje ?? (datos as { detail?: string }).detail ?? `Error ${respuesta.status}`);
  return datos as T;
}

/** "14:59" para el tiempo que le queda al código (vence a los 15 minutos, D18). */
export function cuentaRegresiva(venceEn: string, ahora: number): string {
  const restante = Math.max(0, Math.floor((Date.parse(venceEn) - ahora) / 1000));
  return `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}`;
}
