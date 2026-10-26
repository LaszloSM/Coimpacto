"use client";

// Crédito: los préstamos internos que aprueban las asambleas (doble firma), cuánto se
// desembolsa y se abona mes a mes, por comunidad y por monto. Los préstamos son acuerdos entre
// miembros: Credimpacto no presta ni custodia dinero.

import { DownloadSimple, HandCoins } from "@phosphor-icons/react";

import { Bloque, Cabecera, Cargando, Cifras, Etiqueta, Tabla, useDatos, modulo as m } from "../_panel/comunes";
import { pesosCortos, pesosExactos } from "../_panel/formato";
import { BarrasHorizontales, BarrasPorMes, COLOR } from "../_panel/GraficosModulo";
import { ESTADO_PRESTAMO, fechaCorta, type Prestamo } from "../_panel/prestamos";
import { Vacio } from "../_panel/formas";
import estilos from "../_panel/tablero.module.css";

interface DatosCredito {
  resumen: {
    prestamos: number;
    vigentes: number;
    desembolsado: number;
    intereses_pactados: number;
    capital_promedio: number;
    plazo_promedio: number;
    tasa_promedio: number;
  };
  comunidades: {
    id: string;
    nombre: string;
    prestamos: number;
    capital: number;
    intereses: number;
    vigentes: number;
  }[];
  rangos: { rango: string; prestamos: number }[];
  mensual: {
    mes: string;
    desembolsado: number;
    abonado: number;
    prestamos: number;
  }[];
  recientes: Prestamo[];
}

export default function Credito() {
  const { datos, error, recargar } = useDatos<DatosCredito>("/oficina/credito");
  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Crédito"
        sub="Préstamos internos aprobados por cada asamblea, con su desembolso y sus abonos."
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
              icono={HandCoins}
              fantasma="barras"
              titulo="Todavía no hay préstamos internos"
              texto="Un préstamo aparece aquí cuando una asamblea lo aprueba en la reunión, con la votación y las firmas de dos cargos distintos de la junta."
            />
          ) : (
            <>
              <Cifras
                cifras={[
                  {
                    etiqueta: "Capital desembolsado",
                    valor: pesosCortos(d.resumen.desembolsado),
                    numero: d.resumen.desembolsado,
                    formato: pesosCortos,
                    exacto: pesosExactos(d.resumen.desembolsado),
                    pie: `${d.resumen.prestamos} préstamos otorgados`,
                    destacada: true,
                    serie: d.mensual.map((x) => x.desembolsado),
                  },
                  {
                    etiqueta: "Préstamos vigentes",
                    valor: d.resumen.vigentes.toLocaleString("es-CO"),
                    pie: "con saldo por pagar",
                  },
                  {
                    etiqueta: "Préstamo promedio",
                    valor: pesosCortos(d.resumen.capital_promedio),
                    pie: `${d.resumen.plazo_promedio} cuotas en promedio`,
                  },
                  {
                    etiqueta: "Intereses pactados",
                    valor: pesosCortos(d.resumen.intereses_pactados),
                    pie: `tasa promedio ${d.resumen.tasa_promedio.toLocaleString("es-CO")} % mensual`,
                  },
                ]}
              />
              {d.resumen.prestamos ? (
                <p className={m.titular}>
                  Las asambleas aprobaron <strong>{d.resumen.prestamos} préstamos</strong> por {pesosExactos(d.resumen.desembolsado)};{" "}
                  <strong>{d.resumen.vigentes}</strong> siguen con saldo. El préstamo típico es de {pesosCortos(d.resumen.capital_promedio)} a{" "}
                  {d.resumen.plazo_promedio} cuotas.
                </p>
              ) : (
                <p className={m.titular}>Todavía no hay préstamos internos registrados. Aparecen aquí cuando una asamblea aprueba el primero en la app.</p>
              )}
              <div className={m.dosColumnas}>
                <BarrasPorMes
                  titulo="Desembolsos y abonos"
                  sub="Lo que salió en préstamos y lo que volvió en abonos, por mes"
                  datos={d.mensual as unknown as Record<string, number | string>[]}
                  series={[
                    {
                      clave: "desembolsado",
                      texto: "Desembolsado",
                      color: COLOR.azul,
                    },
                    { clave: "abonado", texto: "Abonado", color: COLOR.verde },
                  ]}
                  vacio="Todavía no hay préstamos registrados en los últimos 12 meses."
                />
                <BarrasHorizontales
                  titulo="Préstamos por monto"
                  sub="Cuántos préstamos hay en cada rango"
                  pesos={false}
                  color={COLOR.azul}
                  datos={d.rangos.map((r) => ({
                    nombre: r.rango,
                    valor: r.prestamos,
                  }))}
                  vacio="Todavía no hay préstamos."
                />
              </div>
              <Bloque titulo="Por comunidad">
                <Tabla
                  filas={d.comunidades}
                  clave={(f) => f.id}
                  vacio="Ninguna comunidad ha otorgado préstamos todavía."
                  ordenInicial="capital"
                  columnas={[
                    {
                      clave: "nombre",
                      titulo: "Comunidad",
                      orden: (f) => f.nombre,
                      valor: (f) => <span className={m.nombre}>{f.nombre}</span>,
                    },
                    {
                      clave: "prestamos",
                      titulo: "Préstamos",
                      numero: true,
                      orden: (f) => f.prestamos,
                      valor: (f) => f.prestamos,
                    },
                    {
                      clave: "vigentes",
                      titulo: "Vigentes",
                      numero: true,
                      orden: (f) => f.vigentes,
                      valor: (f) => f.vigentes,
                    },
                    {
                      clave: "capital",
                      titulo: "Capital",
                      numero: true,
                      orden: (f) => f.capital,
                      valor: (f) => pesosCortos(f.capital),
                    },
                    {
                      clave: "intereses",
                      titulo: "Intereses pactados",
                      numero: true,
                      orden: (f) => f.intereses,
                      valor: (f) => pesosCortos(f.intereses),
                    },
                  ]}
                />
              </Bloque>
              <Bloque titulo="Préstamos recientes" sub="Por comunidad y número de miembro, sin datos personales">
                <Tabla
                  filas={d.recientes}
                  clave={(f) => f.id}
                  vacio="Todavía no hay préstamos."
                  columnas={[
                    {
                      clave: "fecha",
                      titulo: "Fecha",
                      orden: (f) => f.fecha,
                      valor: (f) => fechaCorta(f.fecha),
                    },
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
                      clave: "capital",
                      titulo: "Capital",
                      numero: true,
                      orden: (f) => f.capital,
                      valor: (f) => pesosCortos(f.capital),
                    },
                    {
                      clave: "cuotas",
                      titulo: "Cuotas",
                      numero: true,
                      valor: (f) => `${f.cuotas} × ${pesosCortos(f.cuota)}`,
                    },
                    {
                      clave: "saldo",
                      titulo: "Saldo",
                      numero: true,
                      orden: (f) => f.saldo,
                      valor: (f) => pesosCortos(f.saldo),
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
