"use client";

// Gráficos de los módulos (Recharts), con la misma voz que el tablero: naranja para el ahorro,
// azul para el crédito, carbón y gris para lo demás. Sin animación con "reducir movimiento".

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSyncExternalStore } from "react";

import { ChartBar } from "@phosphor-icons/react";

import { mesCorto, pesosCortos, pesosExactos } from "./formato";
import { Vacio } from "./formas";
import estilos from "./tablero.module.css";

export const COLOR = {
  naranja: "#F66A03",
  azul: "#005FC5",
  carbon: "#252525",
  gris: "#C9C7C1",
  verde: "#35A472",
  amarillo: "#F9C032",
  rojo: "#F53D45",
};
const EJE = { fontSize: 12, fill: "#6B6A66" };

function suscribir(aviso: () => void) {
  const consulta = window.matchMedia("(prefers-reduced-motion: no-preference)");
  consulta.addEventListener("change", aviso);
  return () => consulta.removeEventListener("change", aviso);
}

function useAnimar(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
    () => false,
  );
}

export interface Serie {
  clave: string;
  texto: string;
  color: string;
}

function Leyenda({ series }: { series: Serie[] }) {
  return (
    <ul className={estilos.leyenda}>
      {series.map((s) => (
        <li key={s.clave}>
          <span className={estilos.leyendaMuestra} style={{ background: s.color }} aria-hidden />
          {s.texto}
        </li>
      ))}
    </ul>
  );
}

function Globo(props: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  formato: (v: number) => string;
  etiqueta?: (l: string) => string;
}) {
  if (!props.active || !props.payload?.length) return null;
  return (
    <div className={estilos.globo}>
      <p className={estilos.globoTitulo}>{props.etiqueta ? props.etiqueta(String(props.label)) : props.label}</p>
      {props.payload.map((p) => (
        <p key={p.name} className={estilos.globoFila}>
          <span className={estilos.leyendaMuestra} style={{ background: p.color }} aria-hidden />
          {p.name}: {props.formato(Number(p.value))}
        </p>
      ))}
    </div>
  );
}

/** Barras por mes (apiladas o agrupadas). */
export function BarrasPorMes(props: {
  titulo: string;
  sub: string;
  datos: Record<string, number | string>[];
  series: Serie[];
  apiladas?: boolean;
  pesos?: boolean;
  vacio: string;
}) {
  const animar = useAnimar();
  const hay = props.datos.some((d) => props.series.some((s) => Number(d[s.clave]) > 0));
  const formato = props.pesos === false ? (v: number) => v.toLocaleString("es-CO") : pesosExactos;
  return (
    <figure className={estilos.grafico}>
      <figcaption className={estilos.graficoCabeza}>
        <h3 className={estilos.graficoTitulo}>{props.titulo}</h3>
        <p className={estilos.graficoSub}>{props.sub}</p>
      </figcaption>
      {hay ? (
        <>
          <Leyenda series={props.series} />
          <div className={estilos.lienzo}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={props.datos} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#ECEBE8" />
                <XAxis dataKey="mes" tickFormatter={mesCorto} tick={EJE} axisLine={false} tickLine={false} />
                <YAxis
                  tick={EJE}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickCount={4}
                  tickFormatter={(v: number) => (props.pesos === false ? String(v) : pesosCortos(v))}
                />
                <Tooltip cursor={{ fill: "rgb(28 28 28 / 0.04)" }} content={<Globo formato={formato} etiqueta={mesCorto} />} />
                {props.series.map((s, i) => (
                  <Bar
                    key={s.clave}
                    dataKey={s.clave}
                    name={s.texto}
                    fill={s.color}
                    stackId={props.apiladas ? "a" : undefined}
                    radius={props.apiladas && i < props.series.length - 1 ? 0 : [4, 4, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={animar}
                    animationBegin={i * 80}
                    animationDuration={420}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <Vacio compacto icono={ChartBar} fantasma="barras" titulo="Sin datos todavía" texto={props.vacio} />
      )}
    </figure>
  );
}

/** Barras horizontales por nombre (comunidades, zonas, tramos). */
export function BarrasHorizontales(props: {
  titulo: string;
  sub: string;
  datos: { nombre: string; valor: number; color?: string }[];
  color?: string;
  pesos?: boolean;
  vacio: string;
}) {
  const animar = useAnimar();
  const hay = props.datos.some((d) => d.valor > 0);
  const formato = props.pesos === false ? (v: number) => v.toLocaleString("es-CO") : pesosExactos;
  return (
    <figure className={estilos.grafico}>
      <figcaption className={estilos.graficoCabeza}>
        <h3 className={estilos.graficoTitulo}>{props.titulo}</h3>
        <p className={estilos.graficoSub}>{props.sub}</p>
      </figcaption>
      {hay ? (
        <div className={estilos.lienzo} style={{ minHeight: Math.max(200, props.datos.length * 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={props.datos} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="#ECEBE8" />
              <XAxis
                type="number"
                tick={EJE}
                axisLine={false}
                tickLine={false}
                tickCount={4}
                tickFormatter={(v: number) => (props.pesos === false ? String(v) : pesosCortos(v))}
              />
              <YAxis type="category" dataKey="nombre" tick={EJE} axisLine={false} tickLine={false} width={120} />
              <Tooltip cursor={{ fill: "rgb(28 28 28 / 0.04)" }} content={<Globo formato={formato} />} />
              <Bar dataKey="valor" name={props.titulo} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={animar} animationDuration={420}>
                {props.datos.map((d) => (
                  <Cell key={d.nombre} fill={d.color ?? props.color ?? COLOR.naranja} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Vacio compacto icono={ChartBar} fantasma="barras" titulo="Sin datos todavía" texto={props.vacio} />
      )}
    </figure>
  );
}
