"use client";

// Indicadores (alcance 5, D23): por ACAP, el ahorro del ciclo, los préstamos con saldo y lo que
// hay que revisar, con la fecha de sus datos. Las ACAP con datos de hace más de 14 días se ven
// atenuadas, y el total dice cuántas son. Sin datos personales.

import { formatearPesos } from "@credimpacto/reglas";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { t } from "@/i18n";
import { api, SinSesion } from "@/lib/api";

import estilos from "../oficina.module.css";

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
  const [datos, setDatos] = useState<Consolidado | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<Consolidado>("/oficina/consolidado")
      .then(setDatos)
      .catch((e) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : setError(t("indicadores.sinPermiso"))));
  }, [router]);

  return (
    <main className={estilos.paginaAncha}>
      <h1 className={estilos.titulo}>{t("indicadores.titulo")}</h1>
      {error ? (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      ) : !datos ? (
        <p className={estilos.detalle}>{t("indicadores.cargando")}</p>
      ) : (
        <>
          {datos.totales.acaps_con_datos_viejos > 0 ? (
            <p className={estilos.aviso}>{t("indicadores.viejos").replace("{n}", String(datos.totales.acaps_con_datos_viejos))}</p>
          ) : null}
          <div className={estilos.tablaContenedor}>
            <table className={estilos.tabla}>
              <thead>
                <tr>
                  <th scope="col">{t("indicadores.acap")}</th>
                  <th scope="col">{t("indicadores.socios")}</th>
                  <th scope="col">{t("indicadores.reuniones")}</th>
                  <th scope="col">{t("indicadores.ahorro")}</th>
                  <th scope="col">{t("indicadores.prestamos")}</th>
                  <th scope="col">{t("indicadores.saldo")}</th>
                  <th scope="col">{t("indicadores.revisar")}</th>
                </tr>
              </thead>
              <tbody>
                {datos.acaps.map((f) => (
                  <tr key={f.id} className={f.datos_viejos ? estilos.viejo : undefined}>
                    <th scope="row">
                      {f.nombre}
                      <span className={estilos.detalle}>
                        {f.datos_al ? t("indicadores.datosAl").replace("{fecha}", fecha(f.datos_al)) : t("indicadores.sinDatos")}
                      </span>
                    </th>
                    <td>{f.socios}</td>
                    <td>{f.reuniones}</td>
                    <td>{formatearPesos(f.ahorro)}</td>
                    <td>{f.prestamos_con_saldo}</td>
                    <td>{formatearPesos(f.saldo_prestamos)}</td>
                    <td>{f.por_revisar}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t("indicadores.total")}</th>
                  <td>{datos.totales.socios}</td>
                  <td />
                  <td>{formatearPesos(datos.totales.ahorro)}</td>
                  <td>{datos.totales.prestamos_con_saldo}</td>
                  <td>{formatearPesos(datos.totales.saldo_prestamos)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
