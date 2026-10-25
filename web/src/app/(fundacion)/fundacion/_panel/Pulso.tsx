"use client";

// Pulso de comunidades: las que necesitan atención en filas compactas (nombre, estado y por
// qué) y las que están al día en una franja de chips. El estado va en color, palabra y cifra.
// Momento de movimiento del panel: al filtrar, lo que sale se desvanece y lo que queda se
// reacomoda deslizándose (Motion layout, ease-out < 300 ms; nada con "reducir movimiento").

import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { pesosCortos, porcentaje } from "./formato";
import estilos from "./tablero.module.css";
import type { Comunidad, EstadoComunidad } from "./tipos";

export const ESTADOS: Record<EstadoComunidad, { texto: string; orden: number }> = {
  mora: { texto: "En mora", orden: 0 },
  atencion: { texto: "Atención", orden: 1 },
  sin_datos: { texto: "Sin datos", orden: 2 },
  al_dia: { texto: "Al día", orden: 3 },
};

const CURVA: Transition = { duration: 0.24, ease: [0.23, 1, 0.32, 1] };

function detalle(c: Comunidad): string {
  if (c.estado === "sin_datos") {
    return c.dias_sin_datos === null ? "Nunca ha sincronizado" : `Sin datos hace ${c.dias_sin_datos} días`;
  }
  if (c.estado === "mora") return `${porcentaje(c.mora)} de la cartera en mora`;
  if (c.mora > 0) return `${porcentaje(c.mora)} en mora`;
  return `Datos de hace ${c.dias_sin_datos} días`;
}

const enlace = (c: Comunidad) => `/fundacion/indicadores#acap-${c.id}`;

export function Pulso({ comunidades }: { comunidades: Comunidad[] }) {
  const [filtro, setFiltro] = useState<EstadoComunidad | null>(null);
  const reducir = useReducedMotion();
  const transicion = reducir ? { duration: 0 } : CURVA;

  const conteo = useMemo(() => {
    const c: Record<EstadoComunidad, number> = { mora: 0, atencion: 0, sin_datos: 0, al_dia: 0 };
    for (const x of comunidades) c[x.estado] += 1;
    return c;
  }, [comunidades]);

  const visibles = comunidades
    .filter((c) => !filtro || c.estado === filtro)
    .sort((a, b) => ESTADOS[a.estado].orden - ESTADOS[b.estado].orden || a.nombre.localeCompare(b.nombre));
  const atencion = visibles.filter((c) => c.estado !== "al_dia");
  const alDia = visibles.filter((c) => c.estado === "al_dia");

  return (
    <section className={estilos.bloque} aria-labelledby="titulo-pulso">
      <div className={estilos.bloqueCabeza}>
        <h2 id="titulo-pulso" className={estilos.bloqueTitulo}>
          Pulso de las comunidades
        </h2>
        <div className={estilos.filtros} role="group" aria-label="Filtrar por estado">
          {(Object.keys(ESTADOS) as EstadoComunidad[])
            .sort((a, b) => ESTADOS[a].orden - ESTADOS[b].orden)
            .map((estado) => (
              <button
                key={estado}
                type="button"
                className={estilos.filtro}
                data-estado={estado}
                aria-pressed={filtro === estado}
                disabled={conteo[estado] === 0}
                onClick={() => setFiltro(filtro === estado ? null : estado)}
              >
                <span className={estilos.marca} aria-hidden />
                {ESTADOS[estado].texto}
                <span className={estilos.filtroCuenta}>{conteo[estado]}</span>
              </button>
            ))}
        </div>
      </div>

      {atencion.length ? (
        <ul className={estilos.atencion} aria-label="Comunidades que necesitan atención">
          <AnimatePresence initial={false} mode="popLayout">
            {atencion.map((c) => (
              <motion.li
                key={c.id}
                layout={!reducir}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={transicion}
              >
                <Link href={enlace(c)} className={estilos.renglon} data-estado={c.estado}>
                  <span className={estilos.filaNombre}>{c.nombre}</span>
                  <span className={estilos.filaEstado}>
                    <span className={estilos.marca} aria-hidden />
                    {ESTADOS[c.estado].texto}
                  </span>
                  <span className={estilos.filaDetalle}>{detalle(c)}</span>
                  <span className={estilos.filaAhorro}>
                    {pesosCortos(c.ahorro)}
                    <span className={estilos.filaAhorroEtiqueta}> ahorrados</span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : null}

      {alDia.length ? (
        <div className={estilos.alDia}>
          <p className={estilos.alDiaTitulo} id="titulo-al-dia">
            Al día <span className={estilos.alDiaCuenta}>{alDia.length}</span>
          </p>
          <ul className={estilos.chips} aria-labelledby="titulo-al-dia">
            <AnimatePresence initial={false} mode="popLayout">
              {alDia.map((c) => (
                <motion.li
                  key={c.id}
                  layout={!reducir}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={transicion}
                >
                  <Link href={enlace(c)} className={estilos.chip} title={`${c.nombre}: ${pesosCortos(c.ahorro)} ahorrados`}>
                    <span className={estilos.marca} data-estado="al_dia" aria-hidden />
                    {c.nombre}
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
