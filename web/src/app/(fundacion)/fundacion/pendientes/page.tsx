"use client";

// Pendientes: la bandeja de la oficina, lo más grave primero (D2): lo que hay que aclarar, lo que
// la junta no aceptó, lo que espera revisión y las ACAP que no envían datos hace más de 14 días.
// Cada renglón dice qué pasó y lleva a donde se resuelve.

import { ArrowRight, CheckCircle, CloudSlash, HourglassMedium, Scales, WarningOctagon, XCircle, type Icon } from "@phosphor-icons/react";
import Link from "next/link";

import { t, type ClaveTexto } from "@/i18n";

import { Cabecera, Cargando, useDatos } from "../_panel/comunes";
import { Vacio } from "../_panel/formas";
import b from "../_panel/bandeja.module.css";
import estilos from "../_panel/tablero.module.css";

interface Pendiente {
  acap_id: string;
  acap: string;
  tipo: "totales_distintos" | "en_conflicto" | "no_aceptada" | "rechazado" | "por_validar" | "sin_datos";
  codigo: string;
  cuantos: number;
  desde: string | null;
}

const TIPO: Record<Pendiente["tipo"], { icono: Icon; tono: "alerta" | "atencion" | "neutro"; accion: "aclarar" | "comunidad" }> = {
  totales_distintos: { icono: Scales, tono: "alerta", accion: "aclarar" },
  en_conflicto: { icono: WarningOctagon, tono: "alerta", accion: "aclarar" },
  no_aceptada: { icono: XCircle, tono: "atencion", accion: "aclarar" },
  rechazado: { icono: XCircle, tono: "atencion", accion: "aclarar" },
  por_validar: { icono: HourglassMedium, tono: "neutro", accion: "aclarar" },
  sin_datos: { icono: CloudSlash, tono: "neutro", accion: "comunidad" },
};

function describir(f: Pendiente) {
  if (f.tipo === "sin_datos") return f.desde ? t("fundacion.pendiente.sin_datos").replace("{dias}", String(f.cuantos)) : t("fundacion.nuncaSincronizo");
  if (f.tipo === "no_aceptada" || f.tipo === "totales_distintos") return t(`fundacion.pendiente.${f.tipo}`);
  return `${t(`fundacion.pendiente.${f.tipo}` as ClaveTexto)} · ${t("fundacion.registros").replace("{n}", String(f.cuantos))}`;
}

export default function Pendientes() {
  const { datos, error, recargar } = useDatos<Pendiente[]>("/oficina/pendientes");
  return (
    <main className={estilos.pagina}>
      <Cabecera titulo={t("fundacion.titulo")} sub="Lo que necesita a alguien de la Fundación, lo más grave primero. Cada renglón lleva a donde se resuelve." />
      <Cargando datos={datos} error={error} recargar={recargar} forma="lista">
        {(filas) =>
          filas.length === 0 ? (
            <Vacio icono={CheckCircle} titulo={t("fundacion.todoAlDia")} texto="Ninguna comunidad tiene registros por aclarar ni lleva más de 14 días sin enviar datos." />
          ) : (
            <ol className={b.bandeja}>
              {filas.map((f, i) => {
                const tipo = TIPO[f.tipo];
                const Icono = tipo.icono;
                const destino = tipo.accion === "aclarar" ? `/fundacion/por-aclarar?acap=${f.acap_id}` : `/fundacion/comunidades/${f.acap_id}`;
                return (
                  <li key={`${f.acap_id}-${f.tipo}-${f.codigo}-${i}`} style={{ "--i": i } as React.CSSProperties}>
                    <Link href={destino} className={b.renglon} data-tono={tipo.tono}>
                      <span className={b.icono} aria-hidden>
                        <Icono size={20} weight="duotone" />
                      </span>
                      <span className={b.texto}>
                        <span className={b.acap}>{f.acap}</span>
                        <span className={b.detalle}>{describir(f)}</span>
                      </span>
                      {f.codigo ? <code className={b.codigo}>{f.codigo}</code> : null}
                      <span className={b.ir}>
                        {tipo.accion === "aclarar" ? "Aclarar" : "Ver comunidad"}
                        <ArrowRight size={14} weight="bold" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )
        }
      </Cargando>
    </main>
  );
}
