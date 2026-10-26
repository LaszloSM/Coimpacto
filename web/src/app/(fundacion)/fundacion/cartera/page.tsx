"use client";

// Cartera: lo que falta por pagar de los préstamos internos, por tramos de atraso y por
// comunidad, con la lista de préstamos que necesitan seguimiento (sin datos personales).

import { DownloadSimple, Wallet } from "@phosphor-icons/react";

import { Bloque, Cabecera, Cargando, Cifras, Etiqueta, Tabla, useDatos, modulo as m } from "../_panel/comunes";
import { pesosCortos, pesosExactos, porcentaje } from "../_panel/formato";
import { ESTADO_PRESTAMO, fechaCorta, type Prestamo } from "../_panel/prestamos";
import { Vacio } from "../_panel/formas";
import estilos from "../_panel/tablero.module.css";

interface DatosCartera {
  resumen: {
    activa: number;
    vencida: number;
    mora: number;
    prestamos: number;
    en_mora: number;
    atraso_total: number;
  };
  tramos: { tramo: string; texto: string; prestamos: number; saldo: number }[];
  comunidades: {
    id: string;
    nombre: string;
    zona: string;
    saldo: number;
    vencida: number;
    prestamos: number;
    en_mora: number;
    mora: number;
  }[];
  prestamos: Prestamo[];
}

const COLOR_TRAMO: Record<string, string> = {
  al_dia: "var(--verde)",
  "1_30": "var(--amarillo)",
  "31_60": "#E09A00",
  "61_90": "var(--rojo)",
  mas_90: "#B0141C",
};

const TONO_TRAMO: Record<string, string> = {
  al_dia: "bien",
  "1_30": "atencion",
  "31_60": "atencion",
  "61_90": "alerta",
  mas_90: "alerta",
};

export default function Cartera() {
  const { datos, error, recargar } = useDatos<DatosCartera>("/oficina/cartera");
  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Cartera"
        sub="Saldo de los préstamos internos y su atraso, a la fecha de hoy."
        acciones={
          <a className={estilos.botonSecundario} href="/api/oficina/reportes/consolidado.xlsx">
            <DownloadSimple size={16} aria-hidden /> Descargar Excel
          </a>
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) =>
          d.resumen.prestamos === 0 ? (
            <Vacio
              icono={Wallet}
              fantasma="tabla"
              titulo="La cartera está en cero"
              texto="No hay préstamos con saldo por pagar. Cuando una asamblea apruebe uno, aquí se ve su saldo, sus cuotas y si se atrasa."
            />
          ) : (
            <>
              <Cifras
                cifras={[
                  {
                    etiqueta: "Cartera activa",
                    valor: pesosCortos(d.resumen.activa),
                    numero: d.resumen.activa,
                    formato: pesosCortos,
                    exacto: pesosExactos(d.resumen.activa),
                    pie: `${d.resumen.prestamos} préstamos vigentes`,
                    destacada: true,
                  },
                  {
                    etiqueta: "Cartera vencida",
                    valor: pesosCortos(d.resumen.vencida),
                    exacto: pesosExactos(d.resumen.vencida),
                    pie: `${d.resumen.en_mora} préstamos con atraso`,
                  },
                  {
                    etiqueta: "Índice de mora",
                    valor: porcentaje(d.resumen.mora),
                    pie: "vencida sobre activa",
                  },
                  {
                    etiqueta: "Cuotas atrasadas",
                    valor: pesosCortos(d.resumen.atraso_total),
                    pie: "lo que ya debió pagarse",
                  },
                ]}
              />
              {d.resumen.prestamos ? (
                <p className={m.titular}>
                  <strong>{porcentaje(d.resumen.mora)}</strong> de la cartera está en mora.{" "}
                  {d.resumen.en_mora ? (
                    <>
                      <strong>{d.resumen.en_mora} préstamos</strong> deben {pesosExactos(d.resumen.atraso_total)} en cuotas vencidas.
                    </>
                  ) : (
                    "Todos los préstamos vigentes van al día."
                  )}
                </p>
              ) : (
                <p className={m.titular}>No hay préstamos vigentes: la cartera está en cero.</p>
              )}
              <Bloque titulo="Tramos de atraso" sub="Préstamos vigentes según los días desde la cuota que no se pagó">
                {d.resumen.activa ? (
                  <div className={m.tramosBarra} role="img" aria-label={d.tramos.map((t) => `${t.texto}: ${pesosCortos(t.saldo)}`).join(", ")}>
                    {d.tramos
                      .filter((t) => t.saldo > 0)
                      .map((t) => (
                        <span
                          key={t.tramo}
                          title={`${t.texto}: ${pesosExactos(t.saldo)}`}
                          style={{
                            flex: t.saldo,
                            background: COLOR_TRAMO[t.tramo],
                          }}
                        />
                      ))}
                  </div>
                ) : null}
                <dl className={m.tramos}>
                  {d.tramos.map((t) => (
                    <div key={t.tramo} className={m.tramo} data-tono={TONO_TRAMO[t.tramo]}>
                      <dt>{t.texto}</dt>
                      <dd>{t.prestamos}</dd>
                      <dd>{pesosCortos(t.saldo)} de saldo</dd>
                    </div>
                  ))}
                </dl>
              </Bloque>
              <Bloque titulo="Por comunidad">
                <Tabla
                  filas={d.comunidades}
                  clave={(f) => f.id}
                  vacio="No hay préstamos vigentes."
                  ordenInicial="mora"
                  columnas={[
                    {
                      clave: "nombre",
                      titulo: "Comunidad",
                      orden: (f) => f.nombre,
                      valor: (f) => (
                        <>
                          <span className={m.nombre}>{f.nombre}</span>
                          <br />
                          <span className={m.tenue}>{f.zona}</span>
                        </>
                      ),
                    },
                    {
                      clave: "prestamos",
                      titulo: "Vigentes",
                      numero: true,
                      orden: (f) => f.prestamos,
                      valor: (f) => f.prestamos,
                    },
                    {
                      clave: "saldo",
                      titulo: "Saldo",
                      numero: true,
                      orden: (f) => f.saldo,
                      valor: (f) => pesosCortos(f.saldo),
                    },
                    {
                      clave: "vencida",
                      titulo: "Vencida",
                      numero: true,
                      orden: (f) => f.vencida,
                      valor: (f) => pesosCortos(f.vencida),
                    },
                    {
                      clave: "mora",
                      titulo: "Mora",
                      numero: true,
                      orden: (f) => f.mora,
                      valor: (f) => <Etiqueta tono={f.mora > 10 ? "alerta" : f.mora > 0 ? "atencion" : "bien"}>{porcentaje(f.mora)}</Etiqueta>,
                    },
                  ]}
                />
              </Bloque>
              <Bloque titulo="Préstamos para seguimiento" sub="Primero los de más días de atraso">
                <Tabla
                  filas={d.prestamos}
                  clave={(f) => f.id}
                  vacio="No hay préstamos vigentes."
                  columnas={[
                    {
                      clave: "acap",
                      titulo: "Comunidad",
                      orden: (f) => f.acap,
                      valor: (f) => (
                        <>
                          <span className={m.nombre}>{f.acap}</span> <span className={m.tenue}>#{String(f.miembro ?? "").padStart(2, "0")}</span>
                        </>
                      ),
                    },
                    {
                      clave: "fecha",
                      titulo: "Desembolso",
                      orden: (f) => f.fecha,
                      valor: (f) => fechaCorta(f.fecha),
                    },
                    {
                      clave: "capital",
                      titulo: "Capital",
                      numero: true,
                      orden: (f) => f.capital,
                      valor: (f) => pesosCortos(f.capital),
                    },
                    {
                      clave: "abonado",
                      titulo: "Abonado",
                      numero: true,
                      orden: (f) => f.abonado,
                      valor: (f) => pesosCortos(f.abonado),
                    },
                    {
                      clave: "saldo",
                      titulo: "Saldo",
                      numero: true,
                      orden: (f) => f.saldo,
                      valor: (f) => pesosCortos(f.saldo),
                    },
                    {
                      clave: "atraso",
                      titulo: "Atrasado",
                      numero: true,
                      orden: (f) => f.atraso,
                      valor: (f) => (f.atraso ? pesosCortos(f.atraso) : "—"),
                    },
                    {
                      clave: "dias",
                      titulo: "Días",
                      numero: true,
                      orden: (f) => f.dias_atraso,
                      valor: (f) => f.dias_atraso || "—",
                    },
                    {
                      clave: "estado",
                      titulo: "Estado",
                      valor: (f) => <Etiqueta tono={ESTADO_PRESTAMO[f.estado].tono}>{ESTADO_PRESTAMO[f.estado].texto}</Etiqueta>,
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
