"use client";

// Piezas comunes de los módulos del panel: datos con caché (volver a una sección es inmediato y
// se actualiza por detrás), cabecera, franja de cifras, bloques, tablas ordenables, barras de
// avance, etiquetas de estado y el cajón lateral de los formularios.

import { Dialog } from "@base-ui/react/dialog";
import { ArrowDown, ArrowsDownUp, ArrowUp, CaretRight, Rows, X, type Icon } from "@phosphor-icons/react";
import { animate, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { api, SinSesion } from "@/lib/api";

import { Vacio } from "./formas";
import estilos from "./tablero.module.css";
import m from "./modulo.module.css";

export { Campo } from "./formas";

// Lo último que trajo cada ruta: al volver a una sección se pinta de una vez y se refresca.
const cache = new Map<string, unknown>();

/** Trae una ruta de la API; si no hay sesión lleva a entrar. `recargar` vuelve a pedirla. */
export function useDatos<T>(ruta: string) {
  const router = useRouter();
  const [datos, setDatos] = useState<T | null>(() => (cache.get(ruta) as T | undefined) ?? null);
  const [error, setError] = useState<string>();
  const [intento, setIntento] = useState(0);
  const [vista, setVista] = useState(ruta);
  if (vista !== ruta) {
    setVista(ruta);
    setDatos((cache.get(ruta) as T | undefined) ?? null);
  }
  useEffect(() => {
    let vigente = true;
    api<T>(ruta)
      .then((d) => {
        cache.set(ruta, d);
        if (vigente) {
          setDatos(d);
          setError(undefined);
        }
      })
      .catch((e) => {
        if (!vigente) return;
        if (e instanceof SinSesion) router.replace("/fundacion/entrar");
        else if (!cache.has(ruta)) setError("No se pudieron cargar los datos. Revise la conexión e intente de nuevo.");
      });
    return () => {
      vigente = false;
    };
  }, [ruta, router, intento]);
  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  return { datos, error, recargar };
}

export function Cabecera(props: { titulo: string; sub?: string; acciones?: React.ReactNode; antes?: React.ReactNode }) {
  return (
    <header className={estilos.cabeza}>
      <div className={estilos.cabezaTexto}>
        {props.antes}
        <h1 className={estilos.titulo}>{props.titulo}</h1>
        {props.sub ? <p className={estilos.subtitulo}>{props.sub}</p> : null}
      </div>
      {props.acciones ? <div className={m.acciones}>{props.acciones}</div> : null}
    </header>
  );
}

export function Cargando<T>(props: { datos: T | null; error?: string; recargar: () => void; children: (d: T) => React.ReactNode; forma?: "modulo" | "lista" }) {
  if (props.error) {
    return (
      <div className={estilos.error} role="alert">
        <div>
          <p className={estilos.errorTitulo}>No se pudo cargar</p>
          <p>{props.error}</p>
        </div>
        <button type="button" className={estilos.botonSecundario} onClick={props.recargar}>
          Intentar de nuevo
        </button>
      </div>
    );
  }
  if (!props.datos) {
    return (
      <div className={estilos.esqueleto} aria-busy="true" aria-label="Cargando">
        {props.forma === "lista" ? null : (
          <div className={estilos.esqueletoFila}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={estilos.esqueletoCifra} />
            ))}
          </div>
        )}
        <div className={estilos.esqueletoTabla}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
      </div>
    );
  }
  return <>{props.children(props.datos)}</>;
}

export interface CifraDato {
  etiqueta: string;
  valor: string;
  pie?: React.ReactNode;
  exacto?: string;
  destacada?: boolean;
  /** Para contar hasta la cifra al cargar: el número y cómo se escribe. */
  numero?: number;
  formato?: (n: number) => string;
  /** Últimos meses, para la línea pequeña bajo la cifra. */
  serie?: number[];
  color?: string;
}

/** Cuenta desde cero hasta la cifra (500 ms, ease-out) la primera vez; sin animación con
 * "reducir movimiento". Al volver a la sección, la cifra ya está. */
const contadas = new Set<string>();
function Contador({ numero, formato, clave }: { numero: number; formato: (n: number) => string; clave: string }) {
  const nodo = useRef<HTMLSpanElement>(null);
  const reducir = useReducedMotion();
  useEffect(() => {
    if (reducir || !nodo.current || contadas.has(clave)) return;
    contadas.add(clave);
    const control = animate(0, numero, {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => {
        if (nodo.current) nodo.current.textContent = formato(Math.round(v));
      },
    });
    return () => control.stop();
  }, [numero, formato, reducir, clave]);
  return <span ref={nodo}>{formato(numero)}</span>;
}

/** Línea pequeña de la tendencia, con el área tenue y el último punto marcado. */
export function Chispa({ serie, color = "var(--naranja)" }: { serie: number[]; color?: string }) {
  const id = useId();
  if (serie.length < 2) return null;
  const max = Math.max(...serie);
  const min = Math.min(...serie);
  const rango = max - min || 1;
  const puntos = serie.map((v, i) => [(i / (serie.length - 1)) * 100, 27 - ((v - min) / rango) * 22]);
  const [ux, uy] = puntos[puntos.length - 1];
  const linea = puntos.map((p) => p.join(",")).join(" ");
  return (
    <svg className={m.chispa} viewBox="-2 0 104 30" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${linea} 100,30`} fill={`url(#${id})`} />
      <polyline points={linea} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ux} cy={uy} r="2.75" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Cifras({ cifras }: { cifras: CifraDato[] }) {
  return (
    <dl className={estilos.cifras} style={{ "--columnas": cifras.length } as React.CSSProperties}>
      {cifras.map((c, i) => (
        <div key={c.etiqueta} className={c.destacada ? `${estilos.cifra} ${estilos.cifraDestacada}` : estilos.cifra} style={{ "--i": i } as React.CSSProperties}>
          <dt className={estilos.cifraEtiqueta}>{c.etiqueta}</dt>
          <dd className={estilos.cifraValor} title={c.exacto}>
            {c.numero !== undefined && c.formato ? <Contador numero={c.numero} formato={c.formato} clave={`${c.etiqueta}:${c.numero}`} /> : c.valor}
            {c.exacto ? <span className={estilos.oculto}> ({c.exacto})</span> : null}
          </dd>
          {c.pie ? <dd className={estilos.cifraPie}>{typeof c.pie === "string" ? <span className={estilos.variacionNeutra}>{c.pie}</span> : c.pie}</dd> : null}
          {c.serie ? (
            <dd className={m.chispaMarco}>
              <Chispa serie={c.serie} color={c.color ?? (c.destacada ? "var(--naranja)" : "var(--texto-tenue)")} />
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function Bloque(props: { titulo: string; sub?: string; acciones?: React.ReactNode; children: React.ReactNode; plano?: boolean }) {
  const id = useId();
  return (
    <section className={props.plano ? `${estilos.bloque} ${estilos.bloquePlano}` : estilos.bloque} aria-labelledby={id}>
      <div className={estilos.bloqueCabeza}>
        <div>
          <h2 id={id} className={estilos.bloqueTitulo}>
            {props.titulo}
          </h2>
          {props.sub ? <p className={estilos.bloqueSub}>{props.sub}</p> : null}
        </div>
        {props.acciones ? <div className={m.acciones}>{props.acciones}</div> : null}
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
  /** Valor de la fila de totales (con la doble raya del libro). */
  total?: React.ReactNode;
}

export function Tabla<F>(props: {
  filas: F[];
  columnas: Columna<F>[];
  clave: (f: F) => string;
  vacio: string;
  vacioTexto?: string;
  vacioIcono?: Icon;
  vacioAccion?: React.ReactNode;
  alElegir?: (f: F) => void;
  /** Nombre de la fila para el lector de pantalla ("Abrir Shiliwai"). */
  nombreFila?: (f: F) => string;
  ordenInicial?: string;
  totales?: boolean;
}) {
  const [orden, setOrden] = useState<{ clave: string; asc: boolean } | null>(props.ordenInicial ? { clave: props.ordenInicial, asc: false } : null);
  const filas = useMemo(() => {
    if (!orden) return props.filas;
    const col = props.columnas.find((c) => c.clave === orden.clave);
    if (!col?.orden) return props.filas;
    const f = col.orden;
    return [...props.filas].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
      return orden.asc ? r : -r;
    });
  }, [props.filas, props.columnas, orden]);
  if (props.filas.length === 0) {
    return (
      <Vacio
        compacto
        fantasma="tabla"
        icono={props.vacioIcono ?? Rows}
        titulo={props.vacio}
        texto={props.vacioTexto ?? "Aparece aquí en cuanto haya registros."}
        accion={props.vacioAccion}
      />
    );
  }
  const elegible = Boolean(props.alElegir);
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
                    <button
                      type="button"
                      className={m.ordenar}
                      data-activa={activa || undefined}
                      onClick={() =>
                        setOrden({
                          clave: c.clave,
                          asc: activa ? !orden!.asc : false,
                        })
                      }
                    >
                      {c.titulo}
                      {activa ? (
                        orden!.asc ? (
                          <ArrowUp size={12} weight="bold" aria-hidden />
                        ) : (
                          <ArrowDown size={12} weight="bold" aria-hidden />
                        )
                      ) : (
                        <ArrowsDownUp size={12} className={m.ordenarPista} aria-hidden />
                      )}
                    </button>
                  ) : (
                    c.titulo
                  )}
                </th>
              );
            })}
            {elegible ? <th aria-hidden className={m.columnaIr} /> : null}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={props.clave(f)}
              data-elegible={elegible || undefined}
              tabIndex={elegible ? 0 : undefined}
              aria-label={elegible && props.nombreFila ? props.nombreFila(f) : undefined}
              onClick={elegible ? () => props.alElegir!(f) : undefined}
              onKeyDown={
                elegible
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        props.alElegir!(f);
                      }
                    }
                  : undefined
              }
            >
              {props.columnas.map((c, i) =>
                i === 0 ? (
                  <th key={c.clave} scope="row" data-numero={c.numero || undefined}>
                    {c.valor(f)}
                  </th>
                ) : (
                  <td key={c.clave} data-numero={c.numero || undefined}>
                    {c.valor(f)}
                  </td>
                ),
              )}
              {elegible ? (
                <td className={m.columnaIr} aria-hidden>
                  <CaretRight size={14} weight="bold" />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        {props.totales ? (
          <tfoot>
            <tr>
              {props.columnas.map((c, i) => (
                <td key={c.clave} data-numero={c.numero || undefined}>
                  {i === 0 && c.total === undefined ? "Total" : c.total}
                </td>
              ))}
              {elegible ? <td /> : null}
            </tr>
          </tfoot>
        ) : null}
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

/** Cajón lateral para crear o editar: atrapa el foco, se cierra con Escape, con el velo o con la X.
 * Entra desde la derecha con la curva de cajón y sale por el mismo lado, más rápido. */
export function Lateral(props: { abierto: boolean; titulo: string; descripcion?: string; alCerrar: () => void; children: React.ReactNode }) {
  return (
    <Dialog.Root open={props.abierto} onOpenChange={(abierto) => (abierto ? undefined : props.alCerrar())}>
      <Dialog.Portal>
        <Dialog.Backdrop className={m.velo} />
        <Dialog.Popup className={m.lateral}>
          <div className={m.lateralCabeza}>
            <div>
              <Dialog.Title className={m.lateralTitulo}>{props.titulo}</Dialog.Title>
              {props.descripcion ? <Dialog.Description className={m.lateralDescripcion}>{props.descripcion}</Dialog.Description> : null}
            </div>
            <Dialog.Close className={m.cerrar} aria-label="Cerrar">
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>
          <div className={m.lateralCuerpo}>{props.children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
