"use client";

// Capacitaciones: talleres de educación financiera, reglamento, uso de la app y demás. Se
// cuentan asistentes y horas; no se guardan nombres.

import { ChalkboardTeacher, Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Bloque, Cabecera, Campo, Cargando, Cifras, Etiqueta, Lateral, Tabla, useDatos, useEnvio, modulo as m } from "../_panel/comunes";
import { BarrasHorizontales, COLOR } from "../_panel/GraficosModulo";
import { fechaCorta } from "../_panel/prestamos";
import { Seccion, Selector, Vacio } from "../_panel/formas";
import estilos from "../_panel/tablero.module.css";

interface Capacitacion {
  id: string;
  acap_id: string | null;
  acap: string;
  tema: string;
  tema_texto: string;
  titulo: string;
  fecha: string;
  horas: number;
  asistentes: number;
  facilitador: string;
  notas: string;
}

interface Datos {
  capacitaciones: Capacitacion[];
  temas: { valor: string; texto: string }[];
}

const hoy = () => new Date().toISOString().slice(0, 10);

export default function Capacitaciones() {
  const { datos, error, recargar } = useDatos<Datos>("/oficina/capacitaciones");
  const comunidades = useDatos<{ id: string; nombre: string }[]>("/oficina/comunidades");
  const { enviar, enviando, error: errorEnvio, setError } = useEnvio();
  const [abierto, setAbierto] = useState(false);
  const [forma, setForma] = useState({
    acap_id: "",
    tema: "educacion_financiera",
    titulo: "",
    fecha: hoy(),
    horas: "2",
    asistentes: "0",
    facilitador: "",
    notas: "",
  });
  const cambiar = (campo: keyof typeof forma) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForma({ ...forma, [campo]: e.target.value });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await enviar("/oficina/capacitaciones", {
      ...forma,
      acap_id: forma.acap_id || null,
      horas: forma.horas,
      asistentes: Number(forma.asistentes),
    });
    if (ok) {
      setAbierto(false);
      recargar();
    }
  };

  const porTema = useMemo(() => {
    const t = new Map<string, number>();
    for (const c of datos?.capacitaciones ?? []) t.set(c.tema_texto, (t.get(c.tema_texto) ?? 0) + c.asistentes);
    return [...t.entries()].map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor);
  }, [datos]);

  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Capacitaciones"
        sub="Formación que la Fundación lleva a las comunidades."
        acciones={
          datos?.capacitaciones.length ? (
            <button
              type="button"
              className={estilos.botonPrincipal}
              onClick={() => {
                setError(undefined);
                setAbierto(true);
              }}
            >
              <Plus size={16} weight="bold" aria-hidden /> Registrar capacitación
            </button>
          ) : null
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) => {
          const anio = d.capacitaciones.filter((c) => c.fecha >= `${new Date().getFullYear()}-01-01`);
          return (
            <>
              {d.capacitaciones.length === 0 ? (
                <Vacio
                  icono={ChalkboardTeacher}
                  fantasma="tabla"
                  titulo="Registre la primera capacitación"
                  texto="Cada taller de educación financiera, reglamento o uso de la app queda con su fecha, horas y asistentes. El panel lo suma por tema y por comunidad."
                  accion={
                    <button
                      type="button"
                      className={estilos.botonPrincipal}
                      onClick={() => {
                        setError(undefined);
                        setAbierto(true);
                      }}
                    >
                      <Plus size={16} weight="bold" aria-hidden /> Registrar capacitación
                    </button>
                  }
                />
              ) : (
                <>
                  <Cifras
                    cifras={[
                      {
                        etiqueta: "Capacitaciones este año",
                        valor: String(anio.length),
                        pie: `${d.capacitaciones.length} en total`,
                        destacada: true,
                      },
                      {
                        etiqueta: "Asistencias",
                        valor: anio.reduce((s, c) => s + c.asistentes, 0).toLocaleString("es-CO"),
                        pie: "personas este año",
                      },
                      {
                        etiqueta: "Horas de formación",
                        valor: anio.reduce((s, c) => s + c.horas, 0).toLocaleString("es-CO"),
                        pie: "este año",
                      },
                      {
                        etiqueta: "Comunidades",
                        valor: String(new Set(anio.map((c) => c.acap_id).filter(Boolean)).size),
                        pie: "con al menos una este año",
                      },
                    ]}
                  />
                  <div className={m.dosColumnas}>
                    <BarrasHorizontales
                      titulo="Asistencia por tema"
                      sub="Personas en cada tema, desde el inicio"
                      pesos={false}
                      color={COLOR.carbon}
                      datos={porTema}
                      vacio="Todavía no hay capacitaciones registradas."
                    />
                    <Bloque titulo="Cómo se registra" sub="El mismo día del taller">
                      <p className={m.tenue} style={{ margin: 0, lineHeight: 1.6 }}>
                        Registre aquí cada taller el mismo día. La asistencia sale de la lista física firmada; el panel solo guarda cuántas personas asistieron.
                      </p>
                    </Bloque>
                  </div>
                  <Bloque titulo="Historial">
                    <Tabla
                      filas={d.capacitaciones}
                      clave={(c) => c.id}
                      vacio="Todavía no hay capacitaciones registradas."
                      columnas={[
                        {
                          clave: "fecha",
                          titulo: "Fecha",
                          orden: (c) => c.fecha,
                          valor: (c) => fechaCorta(c.fecha),
                        },
                        {
                          clave: "titulo",
                          titulo: "Capacitación",
                          orden: (c) => c.titulo,
                          valor: (c) => (
                            <>
                              <span className={m.nombre}>{c.titulo}</span>
                              <br />
                              <span className={m.tenue}>{c.acap}</span>
                            </>
                          ),
                        },
                        {
                          clave: "tema",
                          titulo: "Tema",
                          valor: (c) => <Etiqueta tono="neutro">{c.tema_texto}</Etiqueta>,
                        },
                        {
                          clave: "asistentes",
                          titulo: "Asistentes",
                          numero: true,
                          orden: (c) => c.asistentes,
                          valor: (c) => c.asistentes,
                        },
                        {
                          clave: "horas",
                          titulo: "Horas",
                          numero: true,
                          orden: (c) => c.horas,
                          valor: (c) => c.horas.toLocaleString("es-CO"),
                        },
                        {
                          clave: "facilitador",
                          titulo: "Facilitador",
                          valor: (c) => <span className={m.tenue}>{c.facilitador || "—"}</span>,
                        },
                      ]}
                    />
                  </Bloque>
                </>
              )}
              <Lateral
                abierto={abierto}
                titulo="Registrar capacitación"
                descripcion="Se cuenta la asistencia de la lista física firmada; el panel no guarda nombres."
                alCerrar={() => setAbierto(false)}
              >
                <form className={m.formulario} onSubmit={guardar}>
                  <Seccion titulo="El taller">
                    <Campo etiqueta="Título">
                      <input required maxLength={120} value={forma.titulo} onChange={cambiar("titulo")} />
                    </Campo>
                    <div className={m.fila2}>
                      <Campo etiqueta="Tema">
                        <Selector valor={forma.tema} opciones={d.temas} alCambiar={(tema) => setForma({ ...forma, tema })} />
                      </Campo>
                      <Campo etiqueta="Comunidad">
                        <Selector
                          valor={forma.acap_id}
                          vacio="Varias comunidades"
                          opciones={(comunidades.datos ?? []).map((c) => ({ valor: c.id, texto: c.nombre }))}
                          alCambiar={(acap_id) => setForma({ ...forma, acap_id })}
                        />
                      </Campo>
                    </div>
                    <div className={m.fila2}>
                      <Campo etiqueta="Fecha">
                        <input type="date" required value={forma.fecha} onChange={cambiar("fecha")} />
                      </Campo>
                      <Campo etiqueta="Horas">
                        <input type="number" min={0.5} step={0.5} value={forma.horas} onChange={cambiar("horas")} />
                      </Campo>
                    </div>
                  </Seccion>
                  <Seccion titulo="Asistencia">
                    <div className={m.fila2}>
                      <Campo etiqueta="Asistentes">
                        <input type="number" min={0} value={forma.asistentes} onChange={cambiar("asistentes")} />
                      </Campo>
                      <Campo etiqueta="Facilitador">
                        <input maxLength={80} value={forma.facilitador} onChange={cambiar("facilitador")} />
                      </Campo>
                    </div>
                    <Campo etiqueta="Notas">
                      <textarea value={forma.notas} onChange={cambiar("notas")} />
                    </Campo>
                  </Seccion>
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
