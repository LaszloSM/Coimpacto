"use client";

// Análisis: lecturas del libro hechas con reglas claras (ritmo del ahorro, participación,
// metas, mora, concentración). Cada lectura lleva a su comunidad. Sin IA en el MVP.

import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";

import { Bloque, Cabecera, Cargando, Cifras, useDatos, modulo as m } from "../_panel/comunes";
import { fechaLarga, pesosCortos, porcentaje } from "../_panel/formato";
import estilos from "../_panel/tablero.module.css";

interface Lectura {
  tono: "alerta" | "neutro" | "bien";
  titulo: string;
  texto: string;
  acap_id?: string;
}

interface DatosAnalisis {
  generado_en: string;
  lecturas: Lectura[];
  indicadores: { participacion: number | null; por_miembro: number; mora: number; comunidades_sin_reunion: number };
}

const ICONO = { alerta: WarningCircle, neutro: Info, bien: CheckCircle } as const;

export default function Analisis() {
  const { datos, error, recargar } = useDatos<DatosAnalisis>("/oficina/analisis");
  return (
    <main className={estilos.pagina}>
      <Cabecera titulo="Análisis" sub="Lo que dicen los números de las comunidades, en frases cortas y con la regla que lo produce." />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) => (
          <>
            <Cifras
              cifras={[
                { etiqueta: "Participación", valor: porcentaje(d.indicadores.participacion), pie: "promedio en la última reunión", destacada: true },
                { etiqueta: "Ahorro por miembro", valor: pesosCortos(d.indicadores.por_miembro), pie: "promedio del ciclo" },
                { etiqueta: "Índice de mora", valor: porcentaje(d.indicadores.mora), pie: "de la cartera activa" },
                { etiqueta: "Sin reunión reciente", valor: String(d.indicadores.comunidades_sin_reunion), pie: "comunidades, más de 45 días" },
              ]}
            />
            <Bloque titulo="Lecturas de hoy" sub={`Calculadas el ${fechaLarga(d.generado_en)}`}>
              {d.lecturas.length === 0 ? (
                <p className={estilos.graficoVacio}>Con los datos actuales no hay nada fuera de lo normal.</p>
              ) : (
                <ul className={m.lecturas}>
                  {d.lecturas.map((l) => {
                    const Icono = ICONO[l.tono];
                    return (
                      <li key={l.titulo + l.texto} className={m.lectura} data-tono={l.tono}>
                        <Icono size={22} weight="fill" aria-hidden />
                        <div>
                          <h3>{l.titulo}</h3>
                          <p>
                            {l.texto}
                            {l.acap_id ? (
                              <>
                                {" "}
                                <Link href={`/fundacion/comunidades/${l.acap_id}`}>Ver comunidad</Link>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Bloque>
            <Bloque titulo="Cómo se calcula" sub="Reglas fijas, iguales para todas las comunidades">
              <ul className={m.tenue} style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Ritmo del ahorro: el último mes con ahorro frente al anterior.</li>
                <li>Participación: miembros que compraron acciones en la última reunión sobre los miembros activos; menos de 60 % pide atención.</li>
                <li>Mora: un préstamo está en mora si debe cuotas vencidas (meses completos desde el desembolso); más de 10 % de la cartera pide visita.</li>
                <li>Sin reunión: más de 45 días desde la última reunión registrada.</li>
              </ul>
            </Bloque>
          </>
        )}
      </Cargando>
    </main>
  );
}
