"use client";

// Personas de una comunidad: directorio con búsqueda y filtros, y la ficha lateral para agregar,
// corregir, registrar la autorización de datos (Ley 1581) o su revocación, y retirar a alguien.
// Sin autorización vigente solo se ve el número de miembro.

import { LockSimple, MagnifyingGlass, Plus, UserPlus, UsersThree } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

import { Etiqueta, Lateral, useDatos, modulo as m } from "./comunes";
import { fechaCorta } from "./prestamos";
import { Campo, Foto, Iniciales, Interruptor, Seccion, Segmentado, Selector, Vacio } from "./formas";
import p from "./personas.module.css";
import estilos from "./tablero.module.css";

export interface Persona {
  id: string;
  numero: number;
  activo: boolean;
  nombre_corto: string | null;
  consentimiento: "vigente" | "falta" | "revocado";
  consentimiento_id: string | null;
  desde: string | null;
  fecha_ingreso: string;
  nombres: string | null;
  apellidos: string | null;
  documento: string | null;
  telefono: string | null;
  genero: string | null;
  fecha_nacimiento: string | null;
  etnia: string | null;
  cabeza_hogar: boolean | null;
}

const GENEROS = [
  { valor: "femenino", texto: "Mujer" },
  { valor: "masculino", texto: "Hombre" },
  { valor: "otro", texto: "Otro" },
  { valor: "no_dice", texto: "No dice" },
];

const ETNIAS = [
  { valor: "", texto: "Sin dato" },
  { valor: "ninguna", texto: "Ninguna" },
  { valor: "indigena", texto: "Indígena" },
  { valor: "afro", texto: "Negra, afrocolombiana" },
  { valor: "raizal", texto: "Raizal" },
  { valor: "palenquera", texto: "Palenquera" },
  { valor: "rrom", texto: "Rrom (gitana)" },
  { valor: "no_dice", texto: "Prefiere no decir" },
];

type Filtro = "todas" | "activas" | "sin_autorizacion" | "retiradas";

const numero = (n: number) => `#${String(n).padStart(2, "0")}`;

function edad(fecha: string | null): number | null {
  if (!fecha) return null;
  const n = new Date(`${fecha}T12:00:00`);
  const hoy = new Date();
  return hoy.getFullYear() - n.getFullYear() - (hoy < new Date(hoy.getFullYear(), n.getMonth(), n.getDate()) ? 1 : 0);
}

const VACIA = {
  nombres: "",
  apellidos: "",
  documento: "",
  telefono: "",
  genero: "",
  fecha_nacimiento: "",
  etnia: "",
  cabeza_hogar: null as boolean | null,
};

export function Personas(props: { acapId: string; cargos?: Record<string, string>; alCambiar?: () => void }) {
  const { datos, error, recargar } = useDatos<Persona[]>(`/oficina/acaps/${props.acapId}/miembros`);
  const reducir = useReducedMotion();
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("activas");
  const [abierta, setAbierta] = useState<Persona | "nueva" | null>(null);

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (datos ?? []).filter((x) => {
      if (filtro === "activas" && !x.activo) return false;
      if (filtro === "retiradas" && x.activo) return false;
      if (filtro === "sin_autorizacion" && x.consentimiento === "vigente") return false;
      if (!q) return true;
      return [numero(x.numero), x.nombres, x.apellidos, x.documento, x.telefono].some((v) => v?.toLowerCase().includes(q));
    });
  }, [datos, buscar, filtro]);

  const cuenta = (f: Filtro) =>
    (datos ?? []).filter((x) => (f === "activas" ? x.activo : f === "retiradas" ? !x.activo : f === "sin_autorizacion" ? x.consentimiento !== "vigente" : true))
      .length;

  const listo = (mensaje: string) => {
    setAbierta(null);
    recargar();
    props.alCambiar?.();
    toast.success(mensaje);
  };

  const activas = (datos ?? []).filter((x) => x.activo);
  const autorizadas = activas.filter((x) => x.consentimiento === "vigente").length;

  if (error) return <p className={m.errorFormulario}>{error}</p>;
  if (!datos)
    return (
      <div className={estilos.esqueletoTabla} aria-busy="true" aria-label="Cargando personas">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
    );

  return (
    <section className={p.directorio} aria-label="Personas de la comunidad">
      {datos.length === 0 ? (
        <Vacio
          icono={UsersThree}
          fantasma="tabla"
          titulo="Todavía no hay personas en esta comunidad"
          texto="Agregue a cada miembro con el número que tiene en el cuaderno y la foto de su autorización de datos. La junta los verá en el celular en la siguiente sincronización."
          accion={
            <button type="button" className={estilos.botonPrincipal} onClick={() => setAbierta("nueva")}>
              <UserPlus size={16} weight="bold" aria-hidden /> Agregar la primera persona
            </button>
          }
        />
      ) : (
        <>
          <div className={p.resumen}>
            <span>
              <strong>{activas.length}</strong> {activas.length === 1 ? "persona activa" : "personas activas"}
            </span>
            <span className={p.cobertura}>
              <span className={p.coberturaBarra} role="img" aria-label={`${autorizadas} de ${activas.length} autorizaron sus datos`}>
                <span style={{ transform: `scaleX(${activas.length ? autorizadas / activas.length : 0})` }} />
              </span>
              <span>
                <strong>{autorizadas}</strong> de {activas.length} autorizaron sus datos
              </span>
            </span>
          </div>
          <div className={p.barra}>
            <label className={p.buscar}>
              <MagnifyingGlass size={16} aria-hidden />
              <input
                type="search"
                placeholder="Buscar por nombre, número o documento"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                aria-label="Buscar personas"
              />
            </label>
            <div className={p.filtros} role="tablist" aria-label="Filtrar personas">
              {(
                [
                  ["activas", "Activas"],
                  ["sin_autorizacion", "Sin autorización"],
                  ["retiradas", "Retiradas"],
                  ["todas", "Todas"],
                ] as [Filtro, string][]
              ).map(([valor, texto]) => (
                <button key={valor} type="button" role="tab" aria-selected={filtro === valor} className={p.filtro} onClick={() => setFiltro(valor)}>
                  {filtro === valor ? (
                    <motion.span
                      layoutId={`filtro-personas-${props.acapId}`}
                      className={p.filtroMarca}
                      transition={{
                        duration: reducir ? 0 : 0.22,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                    />
                  ) : null}
                  <span className={p.filtroTexto}>
                    {texto} <span className={p.filtroCuenta}>{cuenta(valor)}</span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className={estilos.botonPrincipal} onClick={() => setAbierta("nueva")}>
              <Plus size={16} weight="bold" aria-hidden /> Agregar persona
            </button>
          </div>

          {lista.length === 0 ? (
            <Vacio compacto icono={MagnifyingGlass} titulo="Nadie coincide" texto="Pruebe con otro nombre, el número del cuaderno o cambie el filtro." />
          ) : (
            <ul className={p.lista}>
              <AnimatePresence initial={false}>
                {lista.map((x) => {
                  const nombre = x.nombres ? `${x.nombres} ${x.apellidos ?? ""}`.trim() : null;
                  const iniciales = nombre
                    ? nombre
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((s) => s[0]?.toUpperCase())
                        .join("")
                    : "··";
                  const anios = edad(x.fecha_nacimiento);
                  const cargo = props.cargos?.[x.id];
                  return (
                    <motion.li
                      key={x.id}
                      layout={!reducir}
                      initial={reducir ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: reducir ? 0 : 0.16,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                    >
                      <button type="button" className={p.persona} data-retirada={!x.activo || undefined} onClick={() => setAbierta(x)}>
                        <span className={p.numero}>{String(x.numero).padStart(2, "0")}</span>
                        {nombre ? (
                          <Iniciales texto={iniciales} semilla={x.numero} />
                        ) : (
                          <span className={p.sinDatos} aria-hidden>
                            <LockSimple size={16} />
                          </span>
                        )}
                        <span className={p.personaNombre}>
                          <span className={p.personaPrincipal}>{nombre ?? `Miembro ${numero(x.numero)}`}</span>
                          <span className={p.personaDetalle}>
                            {[x.documento ? `CC ${x.documento}` : null, x.telefono, anios !== null ? `${anios} años` : null].filter(Boolean).join(" · ") ||
                              (x.consentimiento === "vigente" ? `Desde el ${fechaCorta(x.fecha_ingreso)}` : "Datos ocultos hasta registrar su autorización")}
                          </span>
                        </span>
                        <span className={p.personaEtiquetas}>
                          {cargo ? <Etiqueta tono="azul">{cargo}</Etiqueta> : null}
                          {!x.activo ? <Etiqueta tono="neutro">Retirada</Etiqueta> : null}
                          <Etiqueta tono={x.consentimiento === "vigente" ? "bien" : "atencion"}>
                            {x.consentimiento === "vigente" ? "Autorizó" : x.consentimiento === "revocado" ? "Revocó" : "Falta autorización"}
                          </Etiqueta>
                        </span>
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}

      <Lateral
        abierto={abierta !== null}
        titulo={abierta === "nueva" ? "Agregar persona" : abierta ? `Miembro ${numero(abierta.numero)}` : ""}
        descripcion={
          abierta === "nueva"
            ? "Recibe el número siguiente del cuaderno. Sin la foto de su autorización no se guardan sus datos."
            : abierta && abierta.consentimiento !== "vigente"
              ? "Para ver y corregir sus datos, registre primero la foto de su autorización."
              : "Corrija sus datos o su perfil. Los cambios quedan en la auditoría."
        }
        alCerrar={() => setAbierta(null)}
      >
        {abierta ? (
          <FichaPersona
            key={abierta === "nueva" ? "nueva" : abierta.id}
            acapId={props.acapId}
            persona={abierta === "nueva" ? null : abierta}
            alGuardar={listo}
            alCancelar={() => setAbierta(null)}
          />
        ) : null}
      </Lateral>
    </section>
  );
}

function FichaPersona(props: { acapId: string; persona: Persona | null; alGuardar: (mensaje: string) => void; alCancelar: () => void }) {
  const x = props.persona;
  const vigente = x?.consentimiento === "vigente";
  const [forma, setForma] = useState(() =>
    x && vigente
      ? {
          nombres: x.nombres ?? "",
          apellidos: x.apellidos ?? "",
          documento: x.documento ?? "",
          telefono: x.telefono ?? "",
          genero: x.genero ?? "",
          fecha_nacimiento: x.fecha_nacimiento ?? "",
          etnia: x.etnia ?? "",
          cabeza_hogar: x.cabeza_hogar,
        }
      : VACIA,
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  const [revocando, setRevocando] = useState(false);
  const [nota, setNota] = useState("");
  const cambiar = (campo: keyof typeof VACIA) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForma({ ...forma, [campo]: e.target.value });

  const enviar = async (accion: () => Promise<unknown>, mensaje: string) => {
    setEnviando(true);
    setError(undefined);
    try {
      await accion();
      props.alGuardar(mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  };

  const multipart = () => {
    const datos = new FormData();
    for (const [k, v] of Object.entries(forma)) if (v !== "" && v !== null) datos.append(k, String(v));
    if (foto) datos.append("foto", foto);
    return datos;
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!x)
      return void enviar(
        () =>
          api(`/oficina/acaps/${props.acapId}/miembros`, {
            metodo: "POST",
            cuerpo: multipart(),
          }),
        "Persona agregada con su autorización.",
      );
    if (!vigente)
      return void enviar(
        () =>
          api(`/oficina/miembros/${x.id}/consentimiento`, {
            metodo: "POST",
            cuerpo: multipart(),
          }),
        `Autorización de ${numero(x.numero)} registrada.`,
      );
    return void enviar(
      () =>
        api(`/oficina/miembros/${x.id}`, {
          metodo: "PUT",
          cuerpo: { ...forma, fecha_nacimiento: forma.fecha_nacimiento || null },
        }),
      `Datos de ${numero(x.numero)} guardados.`,
    );
  };

  if (revocando && x) {
    return (
      <form
        className={m.formulario}
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData();
          datos.append("nota", nota);
          if (foto) datos.append("foto", foto);
          void enviar(
            () =>
              api(`/oficina/miembros/${x.id}/revocar`, {
                metodo: "POST",
                cuerpo: datos,
              }),
            `Revocación de ${numero(x.numero)} registrada. Sus datos personales se borraron.`,
          );
        }}
      >
        <Seccion
          titulo="Registrar que revocó la autorización"
          texto="Sus datos personales se borran de inmediato. Su número y sus cifras en el libro se quedan, como pide la ley."
        >
          <Campo etiqueta="Cómo lo pidió">
            <input required maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Por ejemplo: de palabra ante la facilitadora" />
          </Campo>
          <Foto etiqueta="Foto del formato de revocación (si lo hay)" archivo={foto} alCambiar={setFoto} />
        </Seccion>
        {error ? (
          <p className={m.errorFormulario} role="alert">
            {error}
          </p>
        ) : null}
        <div className={m.botonera}>
          <button type="button" className={estilos.botonSecundario} onClick={() => setRevocando(false)}>
            Volver
          </button>
          <button type="submit" className={estilos.botonPrincipal} disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar la revocación"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className={m.formulario} onSubmit={guardar}>
      {x ? (
        <div className={p.ficha}>
          <span className={p.fichaNumero}>{numero(x.numero)}</span>
          <span className={p.fichaEstado}>
            <Etiqueta tono={x.activo ? "bien" : "neutro"}>{x.activo ? "Activa en la ACAP" : "Retirada"}</Etiqueta>
            <Etiqueta tono={vigente ? "bien" : "atencion"}>
              {vigente ? `Autorizó${x.desde ? ` el ${new Date(`${x.desde.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}` : ""}` : x.consentimiento === "revocado" ? "Revocó su autorización" : "Falta la autorización"}
            </Etiqueta>
          </span>
        </div>
      ) : null}
      <Seccion titulo="Identificación">
        <div className={m.fila2}>
          <Campo etiqueta="Nombres">
            <input required maxLength={80} autoComplete="off" value={forma.nombres} onChange={cambiar("nombres")} />
          </Campo>
          <Campo etiqueta="Apellidos">
            <input maxLength={80} autoComplete="off" value={forma.apellidos} onChange={cambiar("apellidos")} />
          </Campo>
        </div>
        <div className={m.fila2}>
          <Campo etiqueta="Documento">
            <input inputMode="numeric" maxLength={20} autoComplete="off" value={forma.documento} onChange={cambiar("documento")} />
          </Campo>
          <Campo etiqueta="Celular">
            <input inputMode="tel" maxLength={20} autoComplete="off" value={forma.telefono} onChange={cambiar("telefono")} />
          </Campo>
        </div>
      </Seccion>

      <Seccion
        titulo="Perfil para los informes de impacto"
        texto="Opcional. Se reporta en cifras agregadas, nunca con el nombre. La pertenencia étnica es un dato sensible: solo con la autorización expresa."
      >
        <Segmentado etiqueta="Se identifica como" valor={forma.genero} opciones={GENEROS} alCambiar={(v) => setForma({ ...forma, genero: v })} />
        <div className={m.fila2}>
          <Campo etiqueta="Fecha de nacimiento">
            <input type="date" max={new Date().toISOString().slice(0, 10)} value={forma.fecha_nacimiento} onChange={cambiar("fecha_nacimiento")} />
          </Campo>
          <Campo etiqueta="Pertenencia étnica">
            <Selector valor={forma.etnia} vacio="Sin dato" opciones={ETNIAS.filter((o) => o.valor)} alCambiar={(etnia) => setForma({ ...forma, etnia })} />
          </Campo>
        </div>
        <Interruptor
          etiqueta="Es cabeza de hogar"
          ayuda="Responde por el sustento de su hogar."
          valor={forma.cabeza_hogar === true}
          alCambiar={(v) => setForma({ ...forma, cabeza_hogar: v })}
        />
      </Seccion>

      {!vigente ? (
        <Seccion
          titulo="Autorización de datos (Ley 1581)"
          texto="Foto del formato firmado o con huella. Se guarda cifrada y solo la ve personal autorizado de la Fundación."
        >
          <Foto etiqueta="Foto del formato" archivo={foto} alCambiar={setFoto} requerida />
        </Seccion>
      ) : null}

      {x ? (
        <Seccion titulo="Estado en la comunidad">
          <Interruptor
            etiqueta={x.activo ? "Activa en la ACAP" : "Retirada de la ACAP"}
            ayuda="Al retirarla deja de aparecer en la reunión; su historia en el libro se queda."
            valor={x.activo}
            alCambiar={(activo) =>
              void enviar(
                () =>
                  api(`/oficina/miembros/${x.id}/estado`, {
                    metodo: "POST",
                    cuerpo: { activo },
                  }),
                activo ? `${numero(x.numero)} vuelve a la reunión.` : `${numero(x.numero)} quedó retirada. Su historia en el libro se queda.`,
              )
            }
          />
          {vigente ? (
            <button type="button" className={`${estilos.botonSecundario} ${p.peligro}`} onClick={() => setRevocando(true)}>
              Registrar que revocó la autorización
            </button>
          ) : null}
        </Seccion>
      ) : null}

      {error ? (
        <p className={m.errorFormulario} role="alert">
          {error}
        </p>
      ) : null}
      <div className={m.botonera}>
        <button type="button" className={estilos.botonSecundario} onClick={props.alCancelar}>
          Cancelar
        </button>
        <button type="submit" className={estilos.botonPrincipal} disabled={enviando || (!vigente && !foto)}>
          {enviando ? "Guardando…" : !x ? "Agregar persona" : !vigente ? "Guardar con la autorización" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
