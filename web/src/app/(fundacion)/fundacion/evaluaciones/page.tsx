"use client";

// Evaluaciones: la visita de seguimiento a cada ACAP con cinco criterios de 1 a 5, sus
// fortalezas y los compromisos. El puntaje es el promedio de los cinco.

import { ListChecks, Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Bloque, Cabecera, Campo, Cargando, Cifras, Etiqueta, Lateral, Tabla, useDatos, useEnvio, modulo as m } from "../_panel/comunes";
import { BarrasHorizontales, COLOR } from "../_panel/GraficosModulo";
import { fechaCorta } from "../_panel/prestamos";
import { Selector, Vacio } from "../_panel/formas";
import estilos from "../_panel/tablero.module.css";

type Criterio = "gobernanza" | "transparencia" | "participacion" | "gestion_financiera" | "reglamento";

interface Evaluacion extends Record<Criterio, number> {
  id: string;
  acap_id: string;
  acap: string;
  fecha: string;
  evaluador: string;
  puntaje: number;
  fortalezas: string;
  compromisos: string;
}

interface Datos {
  evaluaciones: Evaluacion[];
  criterios: { valor: Criterio; texto: string }[];
}

const tono = (p: number) => (p >= 4 ? "bien" : p >= 3 ? "atencion" : "alerta");

export default function Evaluaciones() {
  const { datos, error, recargar } = useDatos<Datos>("/oficina/evaluaciones");
  const comunidades = useDatos<{ id: string; nombre: string }[]>("/oficina/comunidades");
  const { enviar, enviando, error: errorEnvio, setError } = useEnvio();
  const [abierto, setAbierto] = useState(false);
  const [forma, setForma] = useState({
    acap_id: "",
    fecha: new Date().toISOString().slice(0, 10),
    evaluador: "",
    fortalezas: "",
    compromisos: "",
  });
  const [puntajes, setPuntajes] = useState<Record<Criterio, number>>({
    gobernanza: 3,
    transparencia: 3,
    participacion: 3,
    gestion_financiera: 3,
    reglamento: 3,
  });

  const ultimas = useMemo(() => {
    const vistas = new Map<string, Evaluacion>();
    for (const e of datos?.evaluaciones ?? []) if (!vistas.has(e.acap_id)) vistas.set(e.acap_id, e);
    return [...vistas.values()];
  }, [datos]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await enviar("/oficina/evaluaciones", { ...forma, ...puntajes });
    if (ok) {
      setAbierto(false);
      recargar();
    }
  };

  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Evaluaciones"
        sub="Visitas de seguimiento a las ACAP, con cinco criterios de 1 a 5."
        acciones={
          datos?.evaluaciones.length ? (
            <button
              type="button"
              className={estilos.botonPrincipal}
              disabled={!comunidades.datos?.length}
              onClick={() => {
                setError(undefined);
                setForma((f) => ({
                  ...f,
                  acap_id: f.acap_id || comunidades.datos?.[0]?.id || "",
                }));
                setAbierto(true);
              }}
            >
              <Plus size={16} weight="bold" aria-hidden /> Nueva evaluación
            </button>
          ) : null
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) => {
          const promedio = ultimas.length ? ultimas.reduce((s, e) => s + e.puntaje, 0) / ultimas.length : null;
          const porCriterio = d.criterios.map((c) => ({
            nombre: c.texto,
            valor: ultimas.length ? Math.round((10 * ultimas.reduce((s, e) => s + e[c.valor], 0)) / ultimas.length) / 10 : 0,
            color: COLOR.carbon,
          }));
          return (
            <>
              {d.evaluaciones.length === 0 ? (
                <Vacio
                  icono={ListChecks}
                  fantasma="tabla"
                  titulo="Todavía no hay visitas de seguimiento"
                  texto="En cada visita se califican cinco criterios de 1 a 5 (gobierno, transparencia, participación, manejo del dinero y reglamento) y se anotan los compromisos."
                  accion={
                    <button
                      type="button"
                      className={estilos.botonPrincipal}
                      disabled={!comunidades.datos?.length}
                      onClick={() => {
                        setError(undefined);
                        setForma((f) => ({
                          ...f,
                          acap_id: f.acap_id || comunidades.datos?.[0]?.id || "",
                        }));
                        setAbierto(true);
                      }}
                    >
                      <Plus size={16} weight="bold" aria-hidden /> Nueva evaluación
                    </button>
                  }
                />
              ) : (
                <>
                  <Cifras
                    cifras={[
                      {
                        etiqueta: "Puntaje promedio",
                        valor:
                          promedio === null
                            ? "Sin datos"
                            : promedio.toLocaleString("es-CO", {
                                maximumFractionDigits: 1,
                              }),
                        pie: "última evaluación de cada ACAP",
                        destacada: true,
                      },
                      {
                        etiqueta: "ACAP evaluadas",
                        valor: String(ultimas.length),
                        pie: `${d.evaluaciones.length} visitas en total`,
                      },
                      {
                        etiqueta: "Con puntaje alto",
                        valor: String(ultimas.filter((e) => e.puntaje >= 4).length),
                        pie: "4 o más",
                      },
                      {
                        etiqueta: "Para acompañar",
                        valor: String(ultimas.filter((e) => e.puntaje < 3).length),
                        pie: "menos de 3",
                      },
                    ]}
                  />
                  <div className={m.dosColumnas}>
                    <BarrasHorizontales
                      titulo="Promedio por criterio"
                      sub="Última evaluación de cada ACAP (de 1 a 5)"
                      pesos={false}
                      datos={porCriterio}
                      vacio="Todavía no hay evaluaciones."
                    />
                    <Bloque titulo="Criterios">
                      <ul className={m.tenue} style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                        {d.criterios.map((c) => (
                          <li key={c.valor}>{c.texto}</li>
                        ))}
                      </ul>
                    </Bloque>
                  </div>
                  <Bloque titulo="Historial de visitas">
                    <Tabla
                      filas={d.evaluaciones}
                      clave={(e) => e.id}
                      vacio="Todavía no hay evaluaciones. Registre la primera visita."
                      columnas={[
                        {
                          clave: "fecha",
                          titulo: "Fecha",
                          orden: (e) => e.fecha,
                          valor: (e) => fechaCorta(e.fecha),
                        },
                        {
                          clave: "acap",
                          titulo: "Comunidad",
                          orden: (e) => e.acap,
                          valor: (e) => <span className={m.nombre}>{e.acap}</span>,
                        },
                        ...d.criterios.map((c) => ({
                          clave: c.valor,
                          titulo: c.texto.split(" ")[0],
                          numero: true,
                          valor: (e: Evaluacion) => e[c.valor],
                        })),
                        {
                          clave: "puntaje",
                          titulo: "Puntaje",
                          numero: true,
                          orden: (e) => e.puntaje,
                          valor: (e) => <Etiqueta tono={tono(e.puntaje)}>{e.puntaje.toLocaleString("es-CO")}</Etiqueta>,
                        },
                        {
                          clave: "compromisos",
                          titulo: "Compromisos",
                          valor: (e) => (
                            <span className={`${m.tenue} ${m.largo}`} style={{ display: "block" }}>
                              {e.compromisos || "—"}
                            </span>
                          ),
                        },
                      ]}
                    />
                  </Bloque>
                </>
              )}
              <Lateral abierto={abierto} titulo="Nueva evaluación" alCerrar={() => setAbierto(false)}>
                <form className={m.formulario} onSubmit={guardar}>
                  <div className={m.fila2}>
                    <Campo etiqueta="Comunidad">
                      <Selector
                        requerido
                        valor={forma.acap_id}
                        opciones={(comunidades.datos ?? []).map((c) => ({ valor: c.id, texto: c.nombre }))}
                        alCambiar={(acap_id) => setForma({ ...forma, acap_id })}
                      />
                    </Campo>
                    <Campo etiqueta="Fecha de la visita">
                      <input type="date" required value={forma.fecha} onChange={(e) => setForma({ ...forma, fecha: e.target.value })} />
                    </Campo>
                  </div>
                  {d.criterios.map((c) => (
                    <div key={c.valor} className={m.campo}>
                      <span className={m.campoEtiqueta} id={`criterio-${c.valor}`}>
                        {c.texto}
                      </span>
                      <div className={m.puntajes} role="group" aria-labelledby={`criterio-${c.valor}`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={m.puntaje}
                            aria-pressed={puntajes[c.valor] === n}
                            onClick={() => setPuntajes({ ...puntajes, [c.valor]: n })}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Campo etiqueta="Evaluador">
                    <input maxLength={80} value={forma.evaluador} onChange={(e) => setForma({ ...forma, evaluador: e.target.value })} />
                  </Campo>
                  <Campo etiqueta="Fortalezas">
                    <textarea value={forma.fortalezas} onChange={(e) => setForma({ ...forma, fortalezas: e.target.value })} />
                  </Campo>
                  <Campo etiqueta="Compromisos">
                    <textarea value={forma.compromisos} onChange={(e) => setForma({ ...forma, compromisos: e.target.value })} />
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
