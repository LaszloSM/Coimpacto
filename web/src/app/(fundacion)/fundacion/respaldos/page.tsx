"use client";

// Subir una copia de seguridad (TX7, D22): el facilitador sube el archivo cifrado que la junta
// envió desde su celular. Se importa como la cola: subirlo dos veces no duplica nada.

import { CheckCircle, CloudArrowUp } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { t, type ClaveTexto } from "@/i18n";
import { SinSesion } from "@/lib/api";

import { Bloque, Cabecera, Etiqueta, modulo as m } from "../_panel/comunes";
import { Archivo } from "../_panel/formas";
import b from "../_panel/bandeja.module.css";
import estilos from "../_panel/tablero.module.css";

interface Resultado {
  elementos: number;
  resultado: Record<string, number>;
}

const TONO: Record<string, "bien" | "atencion" | "alerta" | "neutro"> = {
  confirmado: "bien",
  por_validar: "atencion",
  rechazado: "alerta",
  en_conflicto: "alerta",
  en_espera: "neutro",
};

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
      <Cabecera titulo="Copias de seguridad" sub="Cuando una junta no tiene señal por semanas, envía su libro en un archivo cifrado. Súbalo aquí y entra como si el celular hubiera sincronizado." />
      <div className={b.dos}>
        <Bloque titulo={t("respaldos.titulo")}>
          <form
            className={`${m.formulario} ${m.formularioPlano}`}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!archivo) return;
              setSubiendo(true);
              setError(undefined);
              setResultado(null);
              try {
                setResultado(await subir(await archivo.text()));
                setArchivo(null);
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
            <Archivo
              etiqueta={t("respaldos.archivo")}
              archivo={archivo}
              alCambiar={(a) => {
                setArchivo(a);
                setError(undefined);
              }}
              aceptar="application/json,.json"
              explicacion={
                <>
                  <strong>Elija el archivo</strong> que envió la junta, o suéltelo aquí
                </>
              }
              formatos="Archivo .json de Credimpacto, cifrado en el celular"
            />
            {error ? (
              <p className={m.errorFormulario} role="alert">
                {error}
              </p>
            ) : null}
            <div className={m.botonera}>
              <button className={estilos.botonPrincipal} type="submit" disabled={!archivo || subiendo}>
                <CloudArrowUp size={16} weight="bold" aria-hidden />
                {subiendo ? t("respaldos.subiendo") : t("respaldos.subir")}
              </button>
            </div>
          </form>
          {resultado ? (
            <section className={b.resultado} aria-live="polite">
              <p className={b.resultadoTitulo}>
                <CheckCircle size={20} weight="fill" aria-hidden />
                {t("respaldos.resultado").replace("{total}", String(resultado.elementos))}
              </p>
              <div className={m.acciones}>
                {Object.entries(resultado.resultado).map(([estado, n]) => (
                  <Etiqueta key={estado} tono={TONO[estado] ?? "neutro"}>
                    {t(`respaldos.estado.${estado}` as ClaveTexto)}: {n}
                  </Etiqueta>
                ))}
              </div>
            </section>
          ) : null}
        </Bloque>
        <Bloque titulo="De dónde sale el archivo">
          <ol className={b.pasos}>
            <li>En el celular de la reunión, la junta toca «Copia de seguridad» y pone su PIN.</li>
            <li>El celular arma un archivo cifrado con lo que falta subir y lo comparte por WhatsApp o Bluetooth.</li>
            <li>Súbalo aquí. Si ya había llegado una parte, no se duplica nada: cada registro tiene su número único.</li>
          </ol>
        </Bloque>
      </div>
    </main>
  );
}
