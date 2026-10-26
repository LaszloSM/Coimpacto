"use client";

// Proyectos productivos de las comunidades: idea, formulación, ejecución, terminado. El equipo
// de la Fundación los registra y actualiza su avance desde aquí.

import { Plant, Plus } from "@phosphor-icons/react";
import { useState } from "react";

import { Avance, Bloque, Cabecera, Campo, Cargando, Cifras, Etiqueta, Lateral, useDatos, useEnvio, modulo as m } from "../_panel/comunes";
import { pesosCortos } from "../_panel/formato";
import { CampoPesos, Segmentado, Selector, Vacio } from "../_panel/formas";
import estilos from "../_panel/tablero.module.css";

interface Opcion {
  valor: string;
  texto: string;
}

interface Proyecto {
  id: string;
  acap_id: string;
  acap: string;
  nombre: string;
  linea: string;
  linea_texto: string;
  descripcion: string;
  estado: string;
  estado_texto: string;
  monto_estimado: number;
  participantes: number;
  fecha_inicio: string | null;
  avance: number;
}

interface Datos {
  proyectos: Proyecto[];
  estados: Opcion[];
  lineas: Opcion[];
}

const TONO: Record<string, "neutro" | "azul" | "atencion" | "bien" | "alerta"> = {
  idea: "neutro",
  formulacion: "atencion",
  ejecucion: "azul",
  terminado: "bien",
  suspendido: "alerta",
};

const VACIO = {
  acap_id: "",
  nombre: "",
  linea: "otra",
  descripcion: "",
  estado: "idea",
  monto_estimado: 0,
  participantes: 0,
  fecha_inicio: "",
  avance: 0,
};

export default function Proyectos() {
  const { datos, error, recargar } = useDatos<Datos>("/oficina/proyectos");
  const comunidades = useDatos<{ id: string; nombre: string }[]>("/oficina/comunidades");
  const { enviar, enviando, error: errorEnvio, setError } = useEnvio();
  const [editando, setEditando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [forma, setForma] = useState(VACIO);

  const abrir = (p?: Proyecto) => {
    setError(undefined);
    setEditando(p?.id ?? null);
    setForma(p ? { ...p, fecha_inicio: p.fecha_inicio ?? "" } : { ...VACIO, acap_id: comunidades.datos?.[0]?.id ?? "" });
    setAbierto(true);
  };
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const cuerpo = {
      ...forma,
      fecha_inicio: forma.fecha_inicio || null,
      monto_estimado: Number(forma.monto_estimado),
      participantes: Number(forma.participantes),
      avance: Number(forma.avance),
    };
    const ok = editando ? await enviar(`/oficina/proyectos/${editando}`, cuerpo, "PUT") : await enviar("/oficina/proyectos", cuerpo);
    if (ok) {
      setAbierto(false);
      recargar();
    }
  };
  const cambiar = (campo: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForma({ ...forma, [campo]: e.target.value });

  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Proyectos"
        sub="Proyectos productivos que nacen del ahorro de las comunidades."
        acciones={
          datos?.proyectos.length ? (
            <button type="button" className={estilos.botonPrincipal} onClick={() => abrir()} disabled={!comunidades.datos?.length}>
              <Plus size={16} weight="bold" aria-hidden /> Nuevo proyecto
            </button>
          ) : null
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) => {
          const activos = d.proyectos.filter((p) => p.estado === "ejecucion" || p.estado === "formulacion");
          return (
            <>
              {d.proyectos.length === 0 ? (
                <Vacio
                  icono={Plant}
                  fantasma="tarjetas"
                  titulo="Todavía no hay proyectos productivos"
                  texto="Registre las iniciativas que nacen del ahorro de las comunidades: su línea, la inversión estimada, quiénes participan y cuánto llevan."
                  accion={
                    <button type="button" className={estilos.botonPrincipal} onClick={() => abrir()} disabled={!comunidades.datos?.length}>
                      <Plus size={16} weight="bold" aria-hidden /> Nuevo proyecto
                    </button>
                  }
                />
              ) : (
                <>
                  <Cifras
                    cifras={[
                      {
                        etiqueta: "Proyectos activos",
                        valor: String(activos.length),
                        pie: `${d.proyectos.length} registrados en total`,
                        destacada: true,
                      },
                      {
                        etiqueta: "En ejecución",
                        valor: String(d.proyectos.filter((p) => p.estado === "ejecucion").length),
                        pie: "con avance en curso",
                      },
                      {
                        etiqueta: "Inversión estimada",
                        valor: pesosCortos(activos.reduce((s, p) => s + p.monto_estimado, 0)),
                        pie: "de los proyectos activos",
                      },
                      {
                        etiqueta: "Participantes",
                        valor: activos.reduce((s, p) => s + p.participantes, 0).toLocaleString("es-CO"),
                        pie: "personas en proyectos activos",
                      },
                    ]}
                  />
                  <Bloque titulo="Todos los proyectos" sub="Toque un proyecto para actualizarlo">
                    {d.proyectos.length === 0 ? (
                      <p className={estilos.graficoVacio}>Todavía no hay proyectos. Registre el primero con «Nuevo proyecto».</p>
                    ) : (
                      <ul className={m.tarjetas}>
                        {d.proyectos.map((p) => (
                          <li key={p.id}>
                            <button type="button" className={m.tarjeta} onClick={() => abrir(p)}>
                              <div className={m.tarjetaFila}>
                                <span>{p.acap}</span>
                                <Etiqueta tono={TONO[p.estado] ?? "neutro"}>{p.estado_texto}</Etiqueta>
                              </div>
                              <h3>{p.nombre}</h3>
                              <div className={m.tarjetaFila}>
                                <span>
                                  {p.linea_texto} · {p.participantes} participantes
                                </span>
                                <span>{pesosCortos(p.monto_estimado)}</span>
                              </div>
                              <div className={m.tarjetaFila}>
                                <Avance valor={p.avance} tono="azul" />
                                <span>{p.avance} % de avance</span>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Bloque>
                </>
              )}
              <Lateral abierto={abierto} titulo={editando ? "Actualizar proyecto" : "Nuevo proyecto"} alCerrar={() => setAbierto(false)}>
                <form className={m.formulario} onSubmit={guardar}>
                  <Campo etiqueta="Comunidad">
                    <Selector
                      requerido
                      valor={forma.acap_id}
                      opciones={(comunidades.datos ?? []).map((c) => ({ valor: c.id, texto: c.nombre }))}
                      alCambiar={(acap_id) => setForma({ ...forma, acap_id })}
                    />
                  </Campo>
                  <Campo etiqueta="Nombre del proyecto">
                    <input required maxLength={120} value={forma.nombre} onChange={cambiar("nombre")} />
                  </Campo>
                  <Segmentado etiqueta="Estado" valor={forma.estado} opciones={d.estados} alCambiar={(v) => setForma({ ...forma, estado: v })} />
                  <Segmentado etiqueta="Línea" valor={forma.linea} opciones={d.lineas} alCambiar={(v) => setForma({ ...forma, linea: v })} />
                  <div className={m.fila2}>
                    <CampoPesos
                      etiqueta="Inversión estimada"
                      valor={String(forma.monto_estimado || "")}
                      alCambiar={(v) => setForma({ ...forma, monto_estimado: Number(v) || 0 })}
                    />
                    <Campo etiqueta="Participantes">
                      <input type="number" min={0} value={forma.participantes} onChange={cambiar("participantes")} />
                    </Campo>
                  </div>
                  <div className={m.fila2}>
                    <Campo etiqueta="Fecha de inicio">
                      <input type="date" value={forma.fecha_inicio} onChange={cambiar("fecha_inicio")} />
                    </Campo>
                    <Campo etiqueta={`Avance: ${forma.avance} %`}>
                      <input type="range" min={0} max={100} step={5} value={forma.avance} onChange={cambiar("avance")} />
                    </Campo>
                  </div>
                  <Campo etiqueta="Descripción">
                    <textarea value={forma.descripcion} onChange={cambiar("descripcion")} />
                  </Campo>
                  {errorEnvio ? (
                    <p className={m.errorFormulario} role="alert">
                      {errorEnvio}
                    </p>
                  ) : null}
                  <div className={m.botonera}>
                    <button type="button" className={estilos.botonSecundario} onClick={() => setAbierto(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className={estilos.botonPrincipal} disabled={enviando}>
                      {enviando ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </form>
              </Lateral>
            </>
          );
        }}
      </Cargando>
    </main>
  );
}
