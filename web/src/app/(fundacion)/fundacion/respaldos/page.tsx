"use client";

// Subir una copia de seguridad (TX7, D22): el facilitador sube el archivo cifrado que la junta
// envió desde su celular. Se importa como la cola: subirlo dos veces no duplica nada.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { t, type ClaveTexto } from "@/i18n";
import { SinSesion } from "@/lib/api";

import estilos from "../oficina.module.css";

interface Resultado {
  elementos: number;
  resultado: Record<string, number>;
}

function leerCookie(nombre: string) {
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${nombre}=`));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : "";
}

async function subir(archivo: string): Promise<Resultado> {
  if (!leerCookie("csrftoken")) await fetch("/api/sesion/csrf", { credentials: "same-origin" });
  const r = await fetch("/api/respaldos", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRFToken": leerCookie("csrftoken") },
    body: JSON.stringify({ archivo }),
  });
  if (r.status === 401) throw new SinSesion();
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.codigo ?? "ARCHIVO_INVALIDO");
  return datos as Resultado;
}

export default function Respaldos() {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string>();
  const [subiendo, setSubiendo] = useState(false);

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("respaldos.titulo")}</h1>
      <form
        className={estilos.formulario}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!archivo) return;
          setSubiendo(true);
          setError(undefined);
          setResultado(null);
          try {
            setResultado(await subir(await archivo.text()));
          } catch (err) {
            if (err instanceof SinSesion) return router.replace("/fundacion/entrar");
            const codigo = err instanceof Error ? err.message : "ARCHIVO_INVALIDO";
            const clave = `respaldos.errores.${codigo}` as ClaveTexto;
            try {
              setError(t(clave));
            } catch {
              setError(t("respaldos.errores.ARCHIVO_INVALIDO"));
            }
          } finally {
            setSubiendo(false);
          }
        }}
      >
        <label className={estilos.etiqueta}>
          {t("respaldos.archivo")}
          <input
            className={estilos.campo}
            type="file"
            accept="application/json,.json"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
        </label>
        {error ? (
          <p className={estilos.error} role="alert">
            {error}
          </p>
        ) : null}
        <button className={estilos.principal} type="submit" disabled={!archivo || subiendo}>
          {subiendo ? t("respaldos.subiendo") : t("respaldos.subir")}
        </button>
      </form>
      {resultado ? (
        <section className={estilos.qr} aria-live="polite">
          <p>{t("respaldos.resultado").replace("{total}", String(resultado.elementos))}</p>
          <ul className={estilos.detalle}>
            {Object.entries(resultado.resultado).map(([estado, n]) => (
              <li key={estado}>
                {t(`respaldos.estado.${estado}` as ClaveTexto)}: {n}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
