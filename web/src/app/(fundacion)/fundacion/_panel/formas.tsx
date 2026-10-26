"use client";

// Piezas de formulario y estados del panel con el mundo del libro: campos como renglones de una
// ficha (la raya se vuelve naranja al escribir), opciones cortas como segmentos, interruptores,
// pesos con su valor en letras (como en la app de la reunión) y la página en blanco del
// cuaderno cuando todavía no hay datos.

import { enLetras } from "@credimpacto/reglas";
import { Camera, UploadSimple, type Icon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { cloneElement, isValidElement, useEffect, useId, useMemo, useState } from "react";

import f from "./formas.module.css";

/** Página en blanco del cuaderno: qué va a aparecer aquí, de dónde sale y la acción para empezar. */
export function Vacio(props: {
  icono: Icon;
  titulo: string;
  texto: string;
  accion?: React.ReactNode;
  /** Silueta tenue de lo que aparecerá cuando haya datos. */
  fantasma?: "tabla" | "barras" | "tarjetas";
  compacto?: boolean;
}) {
  const Icono = props.icono;
  return (
    <div className={f.vacio} data-compacto={props.compacto || undefined}>
      {props.fantasma ? <Fantasma tipo={props.fantasma} /> : null}
      <div className={f.vacioCuerpo}>
        <span className={f.vacioIcono} aria-hidden>
          <span className={f.vacioIconoFondo} />
          <Icono size={22} weight="duotone" />
        </span>
        <h3 className={f.vacioTitulo}>{props.titulo}</h3>
        <p className={f.vacioTexto}>{props.texto}</p>
        {props.accion ? <div className={f.vacioAccion}>{props.accion}</div> : null}
      </div>
    </div>
  );
}

function Fantasma({ tipo }: { tipo: "tabla" | "barras" | "tarjetas" }) {
  if (tipo === "barras") {
    return (
      <div className={f.fantasmaBarras} aria-hidden>
        {[38, 52, 46, 64, 58, 72, 66, 80].map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    );
  }
  if (tipo === "tarjetas") {
    return (
      <div className={f.fantasmaTarjetas} aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className={f.fantasmaTabla} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i}>
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  );
}

/** Opciones cortas (2 a 6) como segmentos; la marca se desliza a la elegida. */
export function Segmentado<T extends string>(props: {
  etiqueta: string;
  valor: T;
  opciones: { valor: T; texto: string }[];
  alCambiar: (v: T) => void;
  ayuda?: string;
}) {
  const id = useId();
  const reducir = useReducedMotion();
  return (
    <div className={f.campo}>
      <span className={f.etiqueta} id={id}>
        {props.etiqueta}
      </span>
      <div className={f.segmentos} role="radiogroup" aria-labelledby={id}>
        {props.opciones.map((o) => {
          const activo = o.valor === props.valor;
          return (
            <button key={o.valor} type="button" role="radio" aria-checked={activo} className={f.segmento} onClick={() => props.alCambiar(o.valor)}>
              {activo ? (
                <motion.span
                  layoutId={`marca-${id}`}
                  className={f.segmentoMarca}
                  transition={{
                    duration: reducir ? 0 : 0.22,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                />
              ) : null}
              <span className={f.segmentoTexto}>{o.texto}</span>
            </button>
          );
        })}
      </div>
      {props.ayuda ? <span className={f.ayuda}>{props.ayuda}</span> : null}
    </div>
  );
}

/** Interruptor con su explicación al lado (permisos, sí/no). */
export function Interruptor(props: {
  etiqueta: string;
  ayuda?: string;
  valor: boolean;
  alCambiar: (v: boolean) => void;
  deshabilitado?: boolean;
  compacto?: boolean;
}) {
  const id = useId();
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={props.valor}
      aria-labelledby={props.compacto ? undefined : id}
      aria-label={props.compacto ? props.etiqueta : undefined}
      disabled={props.deshabilitado}
      className={f.interruptor}
      onClick={() => props.alCambiar(!props.valor)}
    >
      <span className={f.interruptorBola} />
    </button>
  );
  if (props.compacto) return control;
  return (
    <div className={f.interruptorFila}>
      <div>
        <span className={f.interruptorEtiqueta} id={id}>
          {props.etiqueta}
        </span>
        {props.ayuda ? <span className={f.ayuda}>{props.ayuda}</span> : null}
      </div>
      {control}
    </div>
  );
}

/** Pesos enteros con su valor en letras debajo, como en la reunión. */
export function CampoPesos(props: { etiqueta: string; valor: string; alCambiar: (v: string) => void; requerido?: boolean; paso?: number }) {
  const id = useId();
  const n = Number(props.valor) || 0;
  return (
    <div className={f.campo}>
      <label className={f.etiqueta} htmlFor={id}>
        {props.etiqueta}
      </label>
      <span className={f.pesos}>
        <span className={f.pesosSigno} aria-hidden>
          $
        </span>
        <input
          id={id}
          className={f.entrada}
          inputMode="numeric"
          required={props.requerido}
          aria-describedby={`${id}-letras`}
          value={props.valor ? Number(props.valor).toLocaleString("es-CO") : ""}
          onChange={(e) => props.alCambiar(e.target.value.replace(/\D/g, "").slice(0, 12))}
        />
      </span>
      <span className={f.ayuda} id={`${id}-letras`} aria-live="polite">
        {n ? enLetras(n) : "Escriba el valor en pesos"}
      </span>
    </div>
  );
}

/** Campo de texto, fecha, número o lista con la etiqueta arriba. La etiqueta nombra solo el
 * control; la ayuda va aparte (aria-describedby) para que el lector de pantalla no la mezcle. */
export function Campo(props: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  const id = useId();
  const control = isValidElement<{ id?: string }>(props.children) ? props.children : null;
  const idControl = control?.props.id ?? id;
  return (
    <div className={f.campo}>
      <label className={f.etiqueta} htmlFor={idControl}>
        {props.etiqueta}
      </label>
      {control ? cloneElement(control as React.ReactElement<Record<string, unknown>>, { id: idControl, "aria-describedby": props.ayuda ? `${id}-ayuda` : undefined }) : props.children}
      {props.ayuda ? (
        <span className={f.ayuda} id={`${id}-ayuda`}>
          {props.ayuda}
        </span>
      ) : null}
    </div>
  );
}

export const entrada = f.entrada;

/** Foto del formato firmado: arrastrar, elegir o tomarla con la cámara del celular. */
export function Foto(props: { etiqueta: string; archivo: File | null; alCambiar: (f: File | null) => void; requerida?: boolean }) {
  const vista = useMemo(() => (props.archivo ? URL.createObjectURL(props.archivo) : null), [props.archivo]);
  const [encima, setEncima] = useState(false);
  useEffect(() => () => void (vista && URL.revokeObjectURL(vista)), [vista]);
  return (
    <label
      className={f.foto}
      data-encima={encima || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        const archivo = e.dataTransfer.files?.[0];
        if (archivo) props.alCambiar(archivo);
      }}
    >
      <span className={f.etiqueta}>{props.etiqueta}</span>
      <input
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        required={props.requerida && !props.archivo}
        className={f.fotoEntrada}
        onChange={(e) => props.alCambiar(e.target.files?.[0] ?? null)}
      />
      {vista ? (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local de un archivo elegido
        <img className={f.fotoVista} src={vista} alt="Vista previa de la foto del formato" />
      ) : (
        <span className={f.fotoVacia}>
          <Camera size={22} weight="duotone" aria-hidden />
          <span>
            <strong>Tome o suba la foto</strong> del formato firmado o con huella
          </span>
          <span className={f.ayuda}>
            <UploadSimple size={12} aria-hidden /> JPG o PNG, hasta 2 MB
          </span>
        </span>
      )}
    </label>
  );
}

/** Sección de un formulario largo, con su título como renglón del cuaderno. */
export function Seccion(props: { titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <fieldset className={f.seccion}>
      <legend className={f.seccionTitulo}>{props.titulo}</legend>
      {props.texto ? <p className={f.seccionTexto}>{props.texto}</p> : null}
      <div className={f.seccionCuerpo}>{props.children}</div>
    </fieldset>
  );
}

/** Iniciales en un cuadro con tono propio por persona (estable por número de miembro). */
export function Iniciales({ texto, semilla }: { texto: string; semilla: number }) {
  const tonos = ["#FFF1E6", "#E8F0FB", "#E8F5EE", "#FEF6E1", "#F1EFEC", "#FCEBEF"];
  const tintas = ["#B54A00", "#005FC5", "#227A52", "#8A5A00", "#5F5E5A", "#A3243F"];
  const i = Math.abs(semilla) % tonos.length;
  return (
    <span className={f.iniciales} style={{ background: tonos[i], color: tintas[i] }} aria-hidden>
      {texto}
    </span>
  );
}
