"use client";

// Comprobante confirmado por enlace (alcance 3, pregunta 2b): lo que el libro de la ACAP tiene de
// un miembro en una reunión cerrada. Número de miembro, nunca nombre ni cédula (Ley 1581).

import { formatearPesos } from "@credimpacto/reglas";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { t, type ClaveTexto } from "@/i18n";

import estilos from "./comprobante.module.css";

interface Comprobante {
  acap: string;
  reunion: number;
  fecha: string;
  numero_miembro: number;
  acciones: number;
  ahorro: number;
  fondo_social: number;
  multas: number;
  abonos: number;
  ahorro_ciclo: number;
  saldo_prestamos: number;
  vence_en: string;
  datos_al: string;
}

type Estado = { listo: Comprobante } | { error: ClaveTexto } | null;

const fecha = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function VerComprobante() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<Estado>(null);

  useEffect(() => {
    fetch(`/api/comprobantes/${encodeURIComponent(token)}`, { cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (r) => {
        if (r.ok) return setEstado({ listo: (await r.json()) as Comprobante });
        const { codigo } = (await r.json().catch(() => ({}))) as { codigo?: string };
        setEstado({
          error: codigo === "VENCIDO" ? "comprobante.vencido" : codigo === "REVOCADO" ? "comprobante.revocado" : "comprobante.noExiste",
        });
      })
      .catch(() => setEstado({ error: "comprobante.sinConexion" }));
  }, [token]);

  if (!estado) {
    return (
      <main className={estilos.pagina} aria-busy="true">
        <div className={estilos.esqueleto} />
        <div className={estilos.esqueleto} />
        <div className={estilos.esqueleto} />
      </main>
    );
  }
  if ("error" in estado) {
    return (
      <main className={estilos.pagina}>
        <h1 className={estilos.titulo}>{t("comprobante.titulo")}</h1>
        <p role="alert">{t(estado.error)}</p>
      </main>
    );
  }

  const c = estado.listo;
  const renglones: [string, number][] = [
    [t("comprobante.ahorro").replace("{n}", String(c.acciones)), c.ahorro],
    [t("comprobante.fondoSocial"), c.fondo_social],
    [t("comprobante.multas"), c.multas],
    [t("comprobante.abonos"), c.abonos],
  ];
  return (
    <main className={estilos.pagina}>
      <p className={estilos.acap}>{c.acap}</p>
      <h1 className={estilos.titulo}>
        {t("comprobante.miembro").replace("{n}", String(c.numero_miembro).padStart(2, "0"))}
      </h1>
      <p className={estilos.reunion}>
        {t("comprobante.reunion").replace("{n}", String(c.reunion)).replace("{fecha}", fecha(c.fecha))}
      </p>
      <p className={estilos.confirmado}>{t("comprobante.confirmado")}</p>
      <dl className={estilos.renglones}>
        {renglones.map(([etiqueta, pesos]) => (
          <div key={etiqueta} className={estilos.renglon}>
            <dt>{etiqueta}</dt>
            <dd>{formatearPesos(pesos)}</dd>
          </div>
        ))}
      </dl>
      <dl className={estilos.renglones}>
        <div className={estilos.renglonFuerte}>
          <dt>{t("comprobante.ahorroCiclo")}</dt>
          <dd>{formatearPesos(c.ahorro_ciclo)}</dd>
        </div>
        <div className={estilos.renglonFuerte}>
          <dt>{t("comprobante.saldoPrestamos")}</dt>
          <dd>{formatearPesos(c.saldo_prestamos)}</dd>
        </div>
      </dl>
      <p className={estilos.pie}>
        {t("comprobante.datosAl").replace("{fecha}", fecha(c.datos_al))} ·{" "}
        {t("comprobante.venceEn").replace("{fecha}", fecha(c.vence_en))}
      </p>
      <p className={estilos.pie}>{t("comprobante.noBanco")}</p>
    </main>
  );
}
