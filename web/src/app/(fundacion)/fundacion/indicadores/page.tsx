"use client";

// Indicadores (alcance 5, D23): por ACAP, el ahorro del ciclo, los préstamos con saldo y lo que
// hay que revisar, con la fecha de sus datos. Las ACAP con datos de hace más de 14 días se
// marcan, y el total dice cuántas son. Sin datos personales.

import { formatearPesos } from "@credimpacto/reglas";
import { useRouter } from "next/navigation";

import { t } from "@/i18n";

import { Bloque, Cabecera, Cargando, Etiqueta, Tabla, useDatos, modulo as m } from "../_panel/comunes";
import estilos from "../_panel/tablero.module.css";

interface Fila {
  id: string;
  nombre: string;
  socios: number;
  reuniones: number;
  ahorro: number;
  prestamos_con_saldo: number;
  saldo_prestamos: number;
  por_revisar: number;
  datos_al: string | null;
  datos_viejos: boolean;
}

interface Consolidado {
  generado_en: string;
  acaps: Fila[];
  totales: { ahorro: number; prestamos_con_saldo: number; saldo_prestamos: number; socios: number; acaps_con_datos_viejos: number };
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

export default function Indicadores() {
  const router = useRouter();
  const { datos, error, recargar } = useDatos<Consolidado>("/oficina/consolidado");
  return (
    <main className={estilos.pagina}>
      <Cabecera titulo={t("indicadores.titulo")} sub="Ahorro, préstamos y pendientes de cada ACAP, con la fecha de sus datos." />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) => (
          <>
            {d.totales.acaps_con_datos_viejos > 0 ? <p className={m.titular}>{t("indicadores.viejos").replace("{n}", String(d.totales.acaps_con_datos_viejos))}</p> : null}
            <Bloque titulo="Consolidado por comunidad" sub={`Calculado el ${fecha(d.generado_en)}`}>
              <Tabla
                filas={d.acaps}
                clave={(f) => f.id}
                vacio="Todavía no hay comunidades."
                alElegir={(f) => router.push(`/fundacion/comunidades/${f.id}`)}
                nombreFila={(f) => `Abrir ${f.nombre}`}
                totales
                columnas={[
                  {
                    clave: "acap",
                    titulo: t("indicadores.acap"),
                    orden: (f) => f.nombre,
                    total: t("indicadores.total"),
                    valor: (f) => (
                      <>
                        <span className={m.nombre}>{f.nombre}</span>
                        <br />
                        {f.datos_viejos ? (
                          <Etiqueta tono="atencion">{f.datos_al ? t("indicadores.datosAl").replace("{fecha}", fecha(f.datos_al)) : t("indicadores.sinDatos")}</Etiqueta>
                        ) : (
                          <span className={m.tenue}>{f.datos_al ? t("indicadores.datosAl").replace("{fecha}", fecha(f.datos_al)) : t("indicadores.sinDatos")}</span>
                        )}
                      </>
                    ),
                  },
                  { clave: "socios", titulo: t("indicadores.socios"), numero: true, orden: (f) => f.socios, valor: (f) => f.socios, total: d.totales.socios },
                  { clave: "reuniones", titulo: t("indicadores.reuniones"), numero: true, orden: (f) => f.reuniones, valor: (f) => f.reuniones },
                  {
                    clave: "ahorro",
                    titulo: t("indicadores.ahorro"),
                    numero: true,
                    orden: (f) => f.ahorro,
                    valor: (f) => formatearPesos(f.ahorro),
                    total: formatearPesos(d.totales.ahorro),
                  },
                  {
                    clave: "prestamos",
                    titulo: t("indicadores.prestamos"),
                    numero: true,
                    orden: (f) => f.prestamos_con_saldo,
                    valor: (f) => f.prestamos_con_saldo,
                    total: d.totales.prestamos_con_saldo,
                  },
                  {
                    clave: "saldo",
                    titulo: t("indicadores.saldo"),
                    numero: true,
                    orden: (f) => f.saldo_prestamos,
                    valor: (f) => formatearPesos(f.saldo_prestamos),
                    total: formatearPesos(d.totales.saldo_prestamos),
                  },
                  {
                    clave: "revisar",
                    titulo: t("indicadores.revisar"),
                    numero: true,
                    orden: (f) => f.por_revisar,
                    valor: (f) => (f.por_revisar ? <Etiqueta tono="atencion">{f.por_revisar}</Etiqueta> : 0),
                  },
                ]}
              />
            </Bloque>
          </>
        )}
      </Cargando>
    </main>
  );
}
