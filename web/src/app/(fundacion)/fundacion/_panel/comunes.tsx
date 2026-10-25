"use client";

// Piezas comunes de los módulos del panel: carga con su esqueleto y reintento, cabecera,
// franja de cifras, tablas ordenables, barras de avance y el panel lateral de formularios.

import { ArrowDown, ArrowUp, X } from "@phosphor-icons/react";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { api, SinSesion } from "@/lib/api";

import estilos from "./tablero.module.css";
import m from "./modulo.module.css";

/** Trae una ruta de la API; si no hay sesión lleva a entrar. `recargar` vuelve a pedirla. */
export function useDatos<T>(ruta: string) {
  const router = useRouter();
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string>();
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    api<T>(ruta)
      .then((d) => {
        if (vigente) {
          setDatos(d);
          setError(undefined);
        }
      })
      .catch((e) => {
        if (!vigente) return;
        if (e instanceof SinSesion) router.replace("/fundacion/entrar");
        else setError("No se pudieron cargar los datos. Revise la conexión e intente de nuevo.");
      });
    return () => {
      vigente = false;
    };
  }, [ruta, router, intento]);
  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  return { datos, error, recargar };
}

export function Cabecera(props: { titulo: string; sub: string; acciones?: React.ReactNode }) {
  return (
    <header className={estilos.cabeza}>
      <div>
        <h1 className={estilos.titulo}>{props.titulo}</h1>
        <p className={estilos.subtitulo}>{props.sub}</p>
      </div>
      {props.acciones ? <div className={m.acciones}>{props.acciones}</div> : null}
    </header>
  );
}

export function Cargando<T>(props: { datos: T | null; error?: string; recargar: () => void; children: (d: T) => React.ReactNode }) {
  if (props.error) {
    return (
      <div className={estilos.error} role="alert">
        <p>{props.error}</p>
        <button type="button" className={estilos.botonSecundario} onClick={props.recargar}>
          Intentar de nuevo
        </button>
      </div>
    );
  }
  if (!props.datos) {
    return (
      <div className={estilos.esqueleto} aria-busy="true" aria-label="Cargando">
        <div className={estilos.esqueletoFila}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={estilos.esqueletoCifra} />
          ))}
        </div>
        <span className={estilos.esqueletoBloque} />
      </div>
    );
  }
  return <>{props.children(props.datos)}</>;
}

export interface CifraDato {
  etiqueta: string;
  valor: string;
  pie?: string;
  exacto?: string;
  destacada?: boolean;
  /** Para contar hasta la cifra al cargar: el número y cómo se escribe. */
  numero?: number;
  formato?: (n: number) => string;
  /** Últimos meses, para la línea pequeña bajo la cifra. */
  serie?: number[];
}

/** Cuenta desde cero hasta la cifra (600 ms, ease-out); sin animación con "reducir movimiento". */
function Contador({ numero, formato }: { numero: number; formato: (n: number) => string }) {
  const nodo = useRef<HTMLSpanElement>(null);
  const reducir = useReducedMotion();
  useEffect(() => {
    if (reducir || !nodo.current) return;
    const control = animate(0, numero, {
      duration: 0.6,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => {
        if (nodo.current) nodo.current.textContent = formato(Math.round(v));
      },
    });
    return () => control.stop();
  }, [numero, formato, reducir]);
  return <span ref={nodo}>{formato(numero)}</span>;
}

/** Línea pequeña de la tendencia, con el último punto marcado. Solo forma: la cifra va arriba. */
export function Chispa({ serie, color = "var(--naranja)" }: { serie: number[]; color?: string }) {
  if (serie.length < 2) return null;
  const max = Math.max(...serie);
  const min = Math.min(...serie);
  const rango = max - min || 1;
  const puntos = serie.map((v, i) => [(i / (serie.length - 1)) * 100, 26 - ((v - min) / rango) * 22]);
  const [ux, uy] = puntos[puntos.length - 1];
  return (
    <svg className={m.chispa} viewBox="-2 0 104 30" preserveAspectRatio="none" aria-hidden>
      <polyline points={puntos.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ux} cy={uy} r="3" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Cifras({ cifras }: { cifras: CifraDato[] }) {
  return (
    <dl className={estilos.cifras} style={{ "--columnas": cifras.length } as React.CSSProperties}>
      {cifras.map((c, i) => (
        <div
          key={c.etiqueta}
          className={c.destacada ? `${estilos.cifra} ${estilos.cifraDestacada}` : estilos.cifra}
          style={{ "--i": i } as React.CSSProperties}
        >
          <dt className={estilos.cifraEtiqueta}>
            {c.destacada ? <span className={estilos.marcaAhorro} aria-hidden /> : null}
            {c.etiqueta}
          </dt>
          <dd className={estilos.cifraValor} title={c.exacto}>
            {c.numero !== undefined && c.formato ? <Contador numero={c.numero} formato={c.formato} /> : c.valor}
          </dd>
          {c.serie ? (
            <dd className={m.chispaMarco}>
              <Chispa serie={c.serie} color={c.destacada ? "var(--naranja)" : "var(--texto-tenue)"} />
            </dd>
          ) : null}
          {c.pie ? (
            <dd className={estilos.cifraPie}>
              <span className={estilos.variacionNeutra}>{c.pie}</span>
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function Bloque(props: { titulo: string; sub?: string; acciones?: React.ReactNode; children: React.ReactNode; ancho?: boolean }) {
  const id = useId();
  return (
    <section className={`${estilos.bloque} ${m.bloque}`} aria-labelledby={id}>
      <div className={estilos.bloqueCabeza}>
        <div>
          <h2 id={id} className={estilos.bloqueTitulo}>
            {props.titulo}
          </h2>
          {props.sub ? <p className={estilos.graficoSub}>{props.sub}</p> : null}
        </div>
        {props.acciones}
      </div>
      {props.children}
    </section>
  );
}

export interface Columna<F> {
  clave: string;
  titulo: string;
  valor: (f: F) => React.ReactNode;
  orden?: (f: F) => number | string;
  numero?: boolean;
}

export function Tabla<F>(props: { filas: F[]; columnas: Columna<F>[]; clave: (f: F) => string; vacio: string; alElegir?: (f: F) => void; ordenInicial?: string }) {
  const [orden, setOrden] = useState<{ clave: string; asc: boolean } | null>(
    props.ordenInicial ? { clave: props.ordenInicial, asc: false } : null,
  );
  const filas = useMemo(() => {
    if (!orden) return props.filas;
    const col = props.columnas.find((c) => c.clave === orden.clave);
    if (!col?.orden) return props.filas;
    const f = col.orden;
    return [...props.filas].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return orden.asc ? r : -r;
    });
  }, [props.filas, props.columnas, orden]);
  if (props.filas.length === 0) return <p className={estilos.graficoVacio}>{props.vacio}</p>;
  return (
    <div className={m.tablaMarco}>
      <table className={m.tabla}>
        <thead>
          <tr>
            {props.columnas.map((c) => {
              const activa = orden?.clave === c.clave;
              return (
                <th key={c.clave} scope="col" data-numero={c.numero || undefined} aria-sort={activa ? (orden!.asc ? "ascending" : "descending") : undefined}>
                  {c.orden ? (
                    <button type="button" className={m.ordenar} onClick={() => setOrden({ clave: c.clave, asc: activa ? !orden!.asc : false })}>
                      {c.titulo}
                      {activa ? orden!.asc ? <ArrowUp size={12} weight="bold" aria-hidden /> : <ArrowDown size={12} weight="bold" aria-hidden /> : null}
                    </button>
                  ) : (
                    c.titulo
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={props.clave(f)} data-elegible={props.alElegir ? true : undefined} onClick={props.alElegir ? () => props.alElegir!(f) : undefined}>
              {props.columnas.map((c) => (
                <td key={c.clave} data-numero={c.numero || undefined}>
                  {c.valor(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Avance({ valor, tono = "naranja" }: { valor: number; tono?: "naranja" | "verde" | "azul" }) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <span className={m.avance} data-tono={tono} role="img" aria-label={`${Math.round(v)} %`}>
      <span style={{ transform: `scaleX(${v / 100})` }} />
    </span>
  );
}

export function Etiqueta({ tono, children }: { tono: "bien" | "atencion" | "alerta" | "neutro" | "azul"; children: React.ReactNode }) {
  return (
    <span className={m.etiqueta} data-tono={tono}>
      {children}
    </span>
  );
}

/** Panel lateral para crear o editar. Se cierra con Escape o con la X. */
export function Lateral(props: { abierto: boolean; titulo: string; alCerrar: () => void; children: React.ReactNode }) {
  const reducir = useReducedMotion();
  const { abierto, alCerrar } = props;
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierto, alCerrar]);
  return (
    <AnimatePresence>
      {props.abierto ? (
        <>
          <motion.div
            className={m.velo}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducir ? 0 : 0.2 }}
            onClick={props.alCerrar}
          />
          <motion.aside
            className={m.lateral}
            role="dialog"
            aria-modal="true"
            aria-label={props.titulo}
            initial={{ transform: "translateX(100%)" }}
            animate={{ transform: "translateX(0%)" }}
            exit={{ transform: "translateX(100%)" }}
            transition={{ duration: reducir ? 0 : 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className={m.lateralCabeza}>
              <h2>{props.titulo}</h2>
              <button type="button" className={m.cerrar} onClick={props.alCerrar} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <div className={m.lateralCuerpo}>{props.children}</div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function Campo(props: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className={m.campo}>
      <span className={m.campoEtiqueta}>{props.etiqueta}</span>
      {props.children}
      {props.ayuda ? <span className={m.campoAyuda}>{props.ayuda}</span> : null}
    </label>
  );
}

/** Envía un formulario a la API y muestra el error del servidor en palabras. */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  const enviar = useCallback(async (ruta: string, cuerpo: unknown, metodo: "POST" | "PUT" = "POST") => {
    setEnviando(true);
    setError(undefined);
    try {
      return await api<Record<string, unknown>>(ruta, { metodo, cuerpo });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return null;
    } finally {
      setEnviando(false);
    }
  }, []);
  return { enviar, enviando, error, setError };
}

export { m as modulo };
