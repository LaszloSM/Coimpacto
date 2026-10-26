"use client";

// Ahorro: cuánto ahorran las comunidades en el ciclo, cómo va mes a mes (historial completo),
// por zona y por comunidad, con participación en la última reunión. Sale del libro.

import { DownloadSimple, PiggyBank } from "@phosphor-icons/react";

import Link from "next/link";

import { Avance, Bloque, Cabecera, Cargando, Cifras, Etiqueta, Tabla, useDatos, modulo as m } from "../_panel/comunes";
import { pesosCortos, pesosExactos, porcentaje } from "../_panel/formato";
import { BarrasHorizontales, BarrasPorMes, COLOR } from "../_panel/GraficosModulo";
import { Vacio } from "../_panel/formas";
import estilos from "../_panel/tablero.module.css";

interface FilaAhorro {
  id: string;
  nombre: string;
  zona: string;
  ciclo: number | null;
  reuniones: number;
  miembros: number;
  ahorro: number;
  fondo_social: number;
  multas: number;
  por_miembro: number;
  meta: number | null;
  ultima_reunion: string | null;
  participacion: number | null;
}

interface DatosAhorro {
  resumen: {
    ahorro_ciclo: number;
    fondo_social_ciclo: number;
    multas_ciclo: number;
    ahorro_historico: number;
    por_miembro: number;
    participacion: number | null;
  };
  comunidades: FilaAhorro[];
  zonas: {
    zona: string;
    ahorro: number;
    comunidades: number;
    miembros: number;
  }[];
  mensual: {
    mes: string;
    ahorro: number;
    fondo_social: number;
    multas: number;
  }[];
}

function fecha(iso: string | null) {
  return iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Sin reuniones";
}

/** La lectura del módulo en una frase: cuánto, quién va adelante y quién necesita apoyo. */
function Titular({ datos }: { datos: DatosAhorro }) {
  const conMiembros = datos.comunidades.filter((c) => c.miembros > 0);
  if (!conMiembros.length) return null;
  const lider = [...conMiembros].sort((a, b) => b.por_miembro - a.por_miembro)[0];
  const baja = conMiembros.filter((c) => c.participacion !== null && c.participacion < 60);
  return (
    <p className={m.titular}>
      Las comunidades llevan <strong>{pesosExactos(datos.resumen.ahorro_ciclo)}</strong> ahorrados en su ciclo actual. <strong>{lider.nombre}</strong> va
      adelante con {pesosCortos(lider.por_miembro)} por miembro
      {baja.length ? (
        <>
          ; {baja.length === 1 ? <strong>{baja[0].nombre}</strong> : <strong>{baja.length} comunidades</strong>} tuvo baja participación en su última reunión.
        </>
      ) : (
        "."
      )}
    </p>
  );
}

export default function Ahorro() {
  const { datos, error, recargar } = useDatos<DatosAhorro>("/oficina/ahorro");
  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Ahorro"
        sub="Acciones, fondo social y multas de cada comunidad, del libro de sus reuniones."
        acciones={
          <a className={estilos.botonSecundario} href="/api/oficina/reportes/consolidado.xlsx">
            <DownloadSimple size={16} aria-hidden /> Descargar Excel
          </a>
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) =>
          d.comunidades.length === 0 ? (
            <Vacio
              icono={PiggyBank}
              fantasma="barras"
              titulo="Todavía no hay ahorro registrado"
              texto="El ahorro aparece cuando las juntas registran sus reuniones en la app o cuando se importa el Excel de una comunidad."
              accion={
                <Link className={estilos.botonPrincipal} href="/fundacion/comunidades">
                  Ir a Comunidades
                </Link>
              }
            />
          ) : (
            <>
              <Cifras
                cifras={[
                  {
                    etiqueta: "Ahorro del ciclo",
                    valor: pesosCortos(d.resumen.ahorro_ciclo),
                    numero: d.resumen.ahorro_ciclo,
                    formato: pesosCortos,
                    exacto: pesosExactos(d.resumen.ahorro_ciclo),
                    pie: `${pesosCortos(d.resumen.ahorro_historico)} en toda la historia`,
                    destacada: true,
                    serie: d.mensual.map((x) => x.ahorro),
                  },
                  {
                    etiqueta: "Fondo social",
                    valor: pesosCortos(d.resumen.fondo_social_ciclo),
                    numero: d.resumen.fondo_social_ciclo,
                    formato: pesosCortos,
                    exacto: pesosExactos(d.resumen.fondo_social_ciclo),
                    pie: "del ciclo actual",
                    serie: d.mensual.map((x) => x.fondo_social),
                  },
                  {
                    etiqueta: "Ahorro por miembro",
                    valor: pesosCortos(d.resumen.por_miembro),
                    exacto: pesosExactos(d.resumen.por_miembro),
                    pie: "promedio del ciclo",
                  },
                  {
                    etiqueta: "Participación",
                    valor: porcentaje(d.resumen.participacion),
                    pie: "ahorró en la última reunión",
                  },
                ]}
              />
              <Titular datos={d} />
              <div className={m.dosColumnas}>
                <BarrasPorMes
                  titulo="Ahorro mes a mes"
                  sub="Acciones compradas en las reuniones de cada mes, últimos 12 meses"
                  datos={d.mensual as unknown as Record<string, number | string>[]}
                  series={[
                    {
                      clave: "ahorro",
                      texto: "Acciones",
                      color: COLOR.naranja,
                    },
                  ]}
                  vacio="Todavía no hay reuniones con ahorro en los últimos 12 meses."
                />
                <BarrasHorizontales
                  titulo="Ahorro por zona"
                  sub="Ciclo actual de cada comunidad"
                  datos={d.zonas.map((z) => ({
                    nombre: z.zona,
                    valor: z.ahorro,
                  }))}
                  vacio="Asigne una zona a cada comunidad para comparar territorios."
                />
              </div>
              <Bloque titulo="Comunidades" sub="Toque una columna para ordenar">
                <Tabla
                  filas={d.comunidades}
                  clave={(f) => f.id}
                  vacio="Todavía no hay comunidades."
                  ordenInicial="ahorro"
                  columnas={[
                    {
                      clave: "nombre",
                      titulo: "Comunidad",
                      orden: (f) => f.nombre,
                      valor: (f) => (
                        <>
                          <span className={m.nombre}>{f.nombre}</span>
                          <br />
                          <span className={m.tenue}>
                            {f.zona}
                            {f.ciclo ? ` · ciclo ${f.ciclo}` : ""}
                          </span>
                        </>
                      ),
                    },
                    {
                      clave: "ahorro",
                      titulo: "Ahorro",
                      numero: true,
                      orden: (f) => f.ahorro,
                      valor: (f) => <span title={pesosExactos(f.ahorro)}>{pesosCortos(f.ahorro)}</span>,
                    },
                    {
                      clave: "fondo",
                      titulo: "Fondo social",
                      numero: true,
                      orden: (f) => f.fondo_social,
                      valor: (f) => pesosCortos(f.fondo_social),
                    },
                    {
                      clave: "multas",
                      titulo: "Multas",
                      numero: true,
                      orden: (f) => f.multas,
                      valor: (f) => pesosCortos(f.multas),
                    },
                    {
                      clave: "miembros",
                      titulo: "Miembros",
                      numero: true,
                      orden: (f) => f.miembros,
                      valor: (f) => f.miembros,
                    },
                    {
                      clave: "por_miembro",
                      titulo: "Por miembro",
                      numero: true,
                      orden: (f) => f.por_miembro,
                      valor: (f) => pesosCortos(f.por_miembro),
                    },
                    {
                      clave: "meta",
                      titulo: "Meta",
                      orden: (f) => (f.meta ? f.ahorro / f.meta : -1),
                      valor: (f) =>
                        f.meta ? (
                          <>
                            <Avance valor={(100 * f.ahorro) / f.meta} /> <span className={m.tenue}>{Math.round((100 * f.ahorro) / f.meta)} %</span>
                          </>
                        ) : (
                          <span className={m.tenue}>Sin meta</span>
                        ),
                    },
                    {
                      clave: "participacion",
                      titulo: "Participación",
                      orden: (f) => f.participacion ?? -1,
                      valor: (f) =>
                        f.participacion === null ? (
                          <span className={m.tenue}>Sin datos</span>
                        ) : (
                          <Etiqueta tono={f.participacion >= 80 ? "bien" : f.participacion >= 60 ? "atencion" : "alerta"}>
                            {porcentaje(f.participacion)}
                          </Etiqueta>
                        ),
                    },
                    {
                      clave: "ultima",
                      titulo: "Última reunión",
                      orden: (f) => f.ultima_reunion ?? "",
                      valor: (f) => <span className={m.tenue}>{fecha(f.ultima_reunion)}</span>,
                    },
                  ]}
                />
              </Bloque>
            </>
          )
        }
      </Cargando>
    </main>
  );
}
