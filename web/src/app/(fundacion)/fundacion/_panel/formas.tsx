"use client";

// Piezas de formulario y estados del panel: campos con la etiqueta arriba y la ayuda abajo,
// selector propio (Base UI: teclado, búsqueda por letra y lector de pantalla), opciones cortas
// como segmentos, interruptores, pesos con su valor en letras, zona para soltar archivos,
// confirmaciones, pestañas y la página en blanco del cuaderno cuando todavía no hay datos.

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Select } from "@base-ui/react/select";
import { Tabs } from "@base-ui/react/tabs";
import { enLetras } from "@credimpacto/reglas";
import { CaretUpDown, Check, FileArrowUp, ImageSquare, Trash, type Icon } from "@phosphor-icons/react";
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
                  transition={reducir ? { duration: 0 } : { type: "spring", duration: 0.3, bounce: 0 }}
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

/** Campo de texto, fecha, número o selector con la etiqueta arriba. La etiqueta nombra solo el
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

export interface Opcion {
  valor: string;
  texto: string;
  detalle?: string;
}

/** Selector de una opción. Reemplaza al <select> del navegador: se abre desde el campo (no desde
 * el centro), se navega con flechas y letras, y marca la elegida. `valor` vacío = ninguna. */
export function Selector(props: {
  id?: string;
  valor: string;
  opciones: Opcion[];
  alCambiar: (v: string) => void;
  vacio?: string;
  requerido?: boolean;
  deshabilitado?: boolean;
  etiqueta?: string;
  "aria-describedby"?: string;
  compacto?: boolean;
}) {
  const items = useMemo(
    () => [...(props.vacio !== undefined ? [{ value: null, label: props.vacio }] : []), ...props.opciones.map((o) => ({ value: o.valor, label: o.texto }))],
    [props.opciones, props.vacio],
  );
  return (
    <Select.Root
      items={items}
      value={props.valor === "" ? null : props.valor}
      onValueChange={(v) => props.alCambiar((v as string | null) ?? "")}
      required={props.requerido}
      disabled={props.deshabilitado}
      modal={false}
    >
      <Select.Trigger
        id={props.id}
        className={f.selector}
        data-compacto={props.compacto || undefined}
        aria-label={props.etiqueta}
        aria-describedby={props["aria-describedby"]}
      >
        <Select.Value className={f.selectorValor} placeholder={props.vacio ?? "Elija una opción"} />
        <Select.Icon className={f.selectorIcono}>
          <CaretUpDown size={14} weight="bold" aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className={f.selectorPosicion} sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup className={f.selectorLista}>
            <Select.List>
              {props.vacio !== undefined ? (
                <Select.Item value={null} className={f.selectorOpcion}>
                  <Select.ItemText className={f.selectorTenue}>{props.vacio}</Select.ItemText>
                  <Select.ItemIndicator className={f.selectorMarca}>
                    <Check size={14} weight="bold" aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ) : null}
              {props.opciones.map((o) => (
                <Select.Item key={o.valor} value={o.valor} className={f.selectorOpcion}>
                  <span className={f.selectorTexto}>
                    <Select.ItemText>{o.texto}</Select.ItemText>
                    {o.detalle ? <span className={f.selectorDetalle}>{o.detalle}</span> : null}
                  </span>
                  <Select.ItemIndicator className={f.selectorMarca}>
                    <Check size={14} weight="bold" aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function tamano(bytes: number) {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Zona para soltar o elegir un archivo. Con `imagen` muestra la vista previa y en el celular
 * ofrece la cámara. Muestra el archivo elegido con su tamaño y deja quitarlo. */
export function Archivo(props: {
  etiqueta: string;
  archivo: File | null;
  alCambiar: (f: File | null) => void;
  aceptar: string;
  explicacion: React.ReactNode;
  formatos: string;
  imagen?: boolean;
  requerido?: boolean;
}) {
  const id = useId();
  const vista = useMemo(() => (props.imagen && props.archivo ? URL.createObjectURL(props.archivo) : null), [props.archivo, props.imagen]);
  const [encima, setEncima] = useState(false);
  useEffect(() => () => void (vista && URL.revokeObjectURL(vista)), [vista]);
  const Icono = props.imagen ? ImageSquare : FileArrowUp;
  return (
    <div className={f.campo}>
      <span className={f.etiqueta} id={`${id}-etiqueta`}>
        {props.etiqueta}
      </span>
      {props.archivo ? (
        <div className={f.archivoElegido}>
          {vista ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local de un archivo elegido
            <img className={f.archivoVista} src={vista} alt="Vista previa del archivo elegido" />
          ) : (
            <span className={f.archivoIcono} aria-hidden>
              <FileArrowUp size={20} weight="duotone" />
            </span>
          )}
          <span className={f.archivoNombre}>
            <strong>{props.archivo.name}</strong>
            <span>{tamano(props.archivo.size)}</span>
          </span>
          <button type="button" className={f.archivoQuitar} onClick={() => props.alCambiar(null)} aria-label={`Quitar ${props.archivo.name}`}>
            <Trash size={16} aria-hidden />
          </button>
        </div>
      ) : (
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
          <input
            type="file"
            accept={props.aceptar}
            capture={props.imagen ? "environment" : undefined}
            required={props.requerido}
            aria-labelledby={`${id}-etiqueta`}
            className={f.fotoEntrada}
            onChange={(e) => props.alCambiar(e.target.files?.[0] ?? null)}
          />
          <span className={f.fotoVacia}>
            <span className={f.fotoIcono} aria-hidden>
              <Icono size={22} weight="duotone" />
            </span>
            <span>{props.explicacion}</span>
            <span className={f.ayuda}>{props.formatos}</span>
          </span>
        </label>
      )}
    </div>
  );
}

/** Foto del formato firmado: arrastrar, elegir o tomarla con la cámara del celular. */
export function Foto(props: { etiqueta: string; archivo: File | null; alCambiar: (f: File | null) => void; requerida?: boolean }) {
  return (
    <Archivo
      etiqueta={props.etiqueta}
      archivo={props.archivo}
      alCambiar={props.alCambiar}
      aceptar="image/jpeg,image/png"
      imagen
      requerido={props.requerida}
      explicacion={
        <>
          <strong>Tome o suba la foto</strong> del formato firmado o con huella
        </>
      }
      formatos="JPG o PNG, hasta 2 MB. También puede soltarla aquí."
    />
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
  const tonos = ["#FFF0E3", "#E7EFFA", "#E3F2E8", "#FCF2DD", "#ECEFF4", "#F1EAF8"];
  const tintas = ["#A84500", "#004C9E", "#124B2E", "#5E3C00", "#3D4A60", "#5A2D82"];
  const i = Math.abs(semilla) % tonos.length;
  return (
    <span className={f.iniciales} style={{ background: tonos[i], color: tintas[i] }} aria-hidden>
      {texto}
    </span>
  );
}

/** Pide confirmar algo que no se puede deshacer fácil. Reemplaza al confirm() del navegador. */
export function Confirmar(props: {
  disparador: React.ReactElement;
  titulo: string;
  texto: string;
  accion: string;
  peligro?: boolean;
  alConfirmar: () => void | Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [haciendo, setHaciendo] = useState(false);
  return (
    <AlertDialog.Root open={abierto} onOpenChange={setAbierto}>
      <AlertDialog.Trigger render={props.disparador} />
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={f.dialogoVelo} />
        <AlertDialog.Popup className={f.dialogo}>
          <AlertDialog.Title className={f.dialogoTitulo}>{props.titulo}</AlertDialog.Title>
          <AlertDialog.Description className={f.dialogoTexto}>{props.texto}</AlertDialog.Description>
          <div className={f.dialogoBotones}>
            <AlertDialog.Close className={f.dialogoCancelar}>Cancelar</AlertDialog.Close>
            <button
              type="button"
              className={props.peligro ? f.dialogoPeligro : f.dialogoAceptar}
              disabled={haciendo}
              onClick={async () => {
                setHaciendo(true);
                try {
                  await props.alConfirmar();
                  setAbierto(false);
                } finally {
                  setHaciendo(false);
                }
              }}
            >
              {haciendo ? "Un momento…" : props.accion}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** Pestañas con la raya que se desliza a la elegida (transición de CSS: se puede interrumpir). */
export function Pestanas<T extends string>(props: {
  valor: T;
  alCambiar: (v: T) => void;
  opciones: readonly (readonly [T, string])[];
  etiqueta: string;
  children?: React.ReactNode;
}) {
  return (
    <Tabs.Root value={props.valor} onValueChange={(v) => props.alCambiar(v as T)}>
      <Tabs.List className={f.pestanas} aria-label={props.etiqueta}>
        {props.opciones.map(([valor, texto]) => (
          <Tabs.Tab key={valor} value={valor} className={f.pestana}>
            {texto}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className={f.pestanaMarca} />
      </Tabs.List>
      {props.opciones.map(([valor]) => (
        <Tabs.Panel key={valor} value={valor} className={f.pestanaPanel}>
          {valor === props.valor ? props.children : null}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
