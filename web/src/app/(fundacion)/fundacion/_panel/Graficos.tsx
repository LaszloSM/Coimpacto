"use client";

// Gráficos del panel (Recharts). Naranja solo para el ahorro; azul de CoimpactoB para el
// crédito; tinta para miembros. Se dibujan escalonados (0, 120, 240 ms), 450 ms ease-out, y
// no se animan con "reducir movimiento".

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartBar } from "@phosphor-icons/react";

import { mesCorto, pesosCortos, pesosExactos } from "./formato";
import { Vacio as VacioKit } from "./formas";
import { COLOR, CURSOR_BARRA, CURSOR_LINEA, EJE, REJILLA, useAnimar } from "./graficoTema";
import estilos from "./tablero.module.css";
import type { Tablero } from "./tipos";

const NARANJA = COLOR.naranja;
const AZUL = COLOR.azul;
const GRIS = COLOR.gris;
const CARBON = COLOR.tinta;

function Vacio({ texto }: { texto: string }) {
  return <VacioKit compacto icono={ChartBar} fantasma="barras" titulo="Sin datos todavía" texto={texto} />;
}

function Leyenda({ items }: { items: { color: string; texto: string }[] }) {
  return (
    <ul className={estilos.leyenda}>
      {items.map((i) => (
        <li key={i.texto}>
          <span className={estilos.leyendaMuestra} style={{ background: i.color }} aria-hidden />
          {i.texto}
        </li>
      ))}
    </ul>
  );
}

function Globo({
  active,
  payload,
  label,
  formato,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  formato: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={estilos.globo}>
      <p className={estilos.globoTitulo}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} className={estilos.globoFila}>
          <span className={estilos.leyendaMuestra} style={{ background: p.color }} aria-hidden />
          {p.name}
          <strong>{formato(p.value ?? 0)}</strong>
        </p>
      ))}
    </div>
  );
}

export function Crecimiento({ serie }: { serie: Tablero["series"]["mensual"] }) {
  const animar = useAnimar();
  const datos = serie.map((s) => ({ ...s, etiqueta: mesCorto(s.mes) }));
  const hayDatos = serie.some((s) => s.ahorro || s.credito);
  return (
    <figure className={estilos.grafico}>
      <figcaption className={estilos.graficoCabeza}>
        <h3 className={estilos.graficoTitulo}>Crecimiento de los últimos 6 meses</h3>
        <p className={estilos.graficoSub}>Ahorro y crédito entregado, acumulados</p>
      </figcaption>
      {hayDatos ? (
        <>
          <Leyenda
            items={[
              { color: NARANJA, texto: "Ahorro" },
              { color: AZUL, texto: "Crédito" },
            ]}
          />
          <div className={estilos.lienzo}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="relleno-ahorro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NARANJA} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={NARANJA} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={REJILLA} />
                <XAxis dataKey="etiqueta" tick={EJE} axisLine={false} tickLine={false} />
                <YAxis tick={EJE} axisLine={false} tickLine={false} width={76} tickFormatter={pesosCortos} />
                <Tooltip content={<Globo formato={pesosExactos} />} cursor={CURSOR_LINEA} />
                <Area
                  name="Ahorro"
                  type="monotone"
                  dataKey="ahorro"
                  stroke={NARANJA}
                  strokeWidth={2}
                  fill="url(#relleno-ahorro)"
                  isAnimationActive={animar}
                  animationBegin={0}
                  animationDuration={450}
                  animationEasing="ease-out"
                />
                <Area
                  name="Crédito"
                  type="monotone"
                  dataKey="credito"
                  stroke={AZUL}
                  strokeWidth={2}
                  fill="transparent"
                  isAnimationActive={animar}
                  animationBegin={0}
                  animationDuration={450}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <Vacio texto="Aparece cuando las juntas sincronicen sus primeras reuniones." />
      )}
    </figure>
  );
}

export function Top({ top }: { top: Tablero["series"]["top"] }) {
  const animar = useAnimar();
  const datos = top
    .filter((t) => t.ahorro > 0)
    .map((t) => ({
      ...t,
      faltante: t.meta ? Math.max(0, t.meta - t.ahorro) : 0,
    }));
  return (
    <figure className={estilos.grafico}>
      <figcaption className={estilos.graficoCabeza}>
        <h3 className={estilos.graficoTitulo}>Comunidades con más ahorro</h3>
        <p className={estilos.graficoSub}>Ciclo actual, frente a su meta cuando la tiene</p>
      </figcaption>
      {datos.length ? (
        <>
          <Leyenda
            items={[
              { color: NARANJA, texto: "Ahorro" },
              { color: GRIS, texto: "Falta para la meta" },
            ]}
          />
          <div className={estilos.lienzo}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={REJILLA} />
                <XAxis type="number" tick={EJE} axisLine={false} tickLine={false} tickFormatter={pesosCortos} tickCount={4} />
                <YAxis type="category" dataKey="nombre" tick={EJE} axisLine={false} tickLine={false} width={96} />
                <Tooltip content={<Globo formato={pesosExactos} />} cursor={CURSOR_BARRA} />
                <Bar
                  name="Ahorro"
                  dataKey="ahorro"
                  stackId="a"
                  fill={NARANJA}
                  maxBarSize={18}
                  isAnimationActive={animar}
                  animationBegin={120}
                  animationDuration={450}
                  animationEasing="ease-out"
                />
                <Bar
                  name="Falta para la meta"
                  dataKey="faltante"
                  stackId="a"
                  fill={GRIS}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  isAnimationActive={animar}
                  animationBegin={120}
                  animationDuration={450}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <Vacio texto="Todavía ninguna comunidad registra ahorro en su ciclo." />
      )}
    </figure>
  );
}

export function Nuevos({ serie }: { serie: Tablero["series"]["nuevos"] }) {
  const animar = useAnimar();
  const datos = serie.map((s) => ({ ...s, etiqueta: mesCorto(s.mes) }));
  const hayDatos = serie.some((s) => s.miembros || s.creditos);
  return (
    <figure className={estilos.grafico}>
      <figcaption className={estilos.graficoCabeza}>
        <h3 className={estilos.graficoTitulo}>Nuevos miembros y créditos</h3>
        <p className={estilos.graficoSub}>Por mes, últimos 6 meses</p>
      </figcaption>
      {hayDatos ? (
        <>
          <Leyenda
            items={[
              { color: CARBON, texto: "Miembros nuevos" },
              { color: AZUL, texto: "Créditos nuevos" },
            ]}
          />
          <div className={estilos.lienzo}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid vertical={false} stroke={REJILLA} />
                <XAxis dataKey="etiqueta" tick={EJE} axisLine={false} tickLine={false} />
                <YAxis tick={EJE} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip content={<Globo formato={(v) => String(v)} />} cursor={CURSOR_BARRA} />
                <Bar
                  name="Miembros nuevos"
                  dataKey="miembros"
                  fill={CARBON}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                  isAnimationActive={animar}
                  animationBegin={240}
                  animationDuration={450}
                  animationEasing="ease-out"
                />
                <Bar
                  name="Créditos nuevos"
                  dataKey="creditos"
                  fill={AZUL}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                  isAnimationActive={animar}
                  animationBegin={240}
                  animationDuration={450}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <Vacio texto="Aparece cuando haya miembros o créditos nuevos en los últimos meses." />
      )}
    </figure>
  );
}
