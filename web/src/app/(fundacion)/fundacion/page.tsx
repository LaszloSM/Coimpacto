"use client";

// Portada de la oficina = bandeja de pendientes por gravedad (D2): lo que hay que aclarar, lo
// que no se aceptó, lo que espera revisión y las ACAP que no envían datos hace más de 14 días.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { t, type ClaveTexto } from "@/i18n";
import { api, SinSesion } from "@/lib/api";

import estilos from "./oficina.module.css";

interface Pendiente {
  acap_id: string;
  acap: string;
  tipo: "en_conflicto" | "no_aceptada" | "rechazado" | "por_validar" | "sin_datos";
  codigo: string;
  cuantos: number;
  desde: string | null;
}

export default function Pendientes() {
  const router = useRouter();
  const [filas, setFilas] = useState<Pendiente[] | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<Pendiente[]>("/oficina/pendientes")
      .then(setFilas)
      .catch((e) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : setError(t("fundacion.sinPermiso"))));
  }, [router]);

  const describir = (f: Pendiente) =>
    f.tipo === "sin_datos"
      ? f.desde
        ? t("fundacion.pendiente.sin_datos").replace("{dias}", String(f.cuantos))
        : t("fundacion.nuncaSincronizo")
      : f.tipo === "no_aceptada"
        ? t("fundacion.pendiente.no_aceptada")
        : `${t(`fundacion.pendiente.${f.tipo}` as ClaveTexto)} · ${t("fundacion.registros").replace("{n}", String(f.cuantos))}`;

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("fundacion.titulo")}</h1>
      <nav aria-label="Secciones" className={estilos.secciones}>
        <Link href="/fundacion/indicadores">{t("fundacion.indicadores")}</Link>
        <Link href="/fundacion/miembros">{t("fundacion.miembros")}</Link>
        <Link href="/fundacion/por-aclarar">{t("fundacion.porAclarar")}</Link>
        <Link href="/fundacion/celulares">{t("fundacion.celulares")}</Link>
        <Link href="/fundacion/respaldos">{t("fundacion.respaldos")}</Link>
      </nav>
      <section aria-live="polite">
        {error ? (
          <p className={estilos.error} role="alert">
            {error}
          </p>
        ) : !filas ? (
          <p className={estilos.detalle}>{t("fundacion.cargando")}</p>
        ) : filas.length === 0 ? (
          <p>{t("fundacion.todoAlDia")}</p>
        ) : (
          <ul className={estilos.lista}>
            {filas.map((f, i) => (
              <li key={`${f.acap_id}-${f.tipo}-${f.codigo}-${i}`} className={estilos.renglon} data-tipo={f.tipo}>
                <strong>{f.acap}</strong>
                <span>{describir(f)}</span>
                {f.codigo ? <code className={estilos.codigo}>{f.codigo}</code> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
