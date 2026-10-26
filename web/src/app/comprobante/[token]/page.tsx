"use client";

// Comprobante confirmado por enlace (alcance 3, pregunta 2b): lo que el libro de la ACAP tiene de
// un miembro en una reunión cerrada, como un recibo de papel. Número de miembro, nunca nombre ni
// cédula (Ley 1581). Se abre en el celular del miembro al escanear el código de la junta.

import { formatearPesos } from "@credimpacto/reglas";
import { CheckCircle, LinkBreak, Notebook, WifiSlash } from "@phosphor-icons/react";
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
      <main className={estilos.mesa} aria-busy="true" aria-label="Cargando el comprobante">
        <div className={`${estilos.sombra} ${estilos.recibo}`}>
          <div className={estilos.esqueleto} />
          <div className={estilos.esqueleto} />
          <div className={estilos.esqueleto} />
          <div className={estilos.esqueleto} />
        </div>
      </main>
    );
  }
  if ("error" in estado) {
    const Icono = estado.error === "comprobante.sinConexion" ? WifiSlash : LinkBreak;
    return (
      <main className={estilos.mesa}>
        <div className={`${estilos.recibo} ${estilos.reciboError}`} style={{ maskImage: "none" }}>
          <span className={estilos.iconoError} aria-hidden>
            <Icono size={28} weight="duotone" />
          </span>
          <h1 className={estilos.titulo}>{t("comprobante.titulo")}</h1>
          <p role="alert" className={estilos.mensaje}>
            {t(estado.error)}
          </p>
        </div>
      </main>
    );
  }

  const c = estado.listo;
  const renglones: [string, number, number?][] = [
    [t("comprobante.ahorro").replace("{n}", String(c.acciones)), c.ahorro, c.acciones],
    [t("comprobante.fondoSocial"), c.fondo_social],
    [t("comprobante.multas"), c.multas],
    [t("comprobante.abonos"), c.abonos],
  ];
  const total = c.ahorro + c.fondo_social + c.multas + c.abonos;
  return (
    <main className={estilos.mesa}>
      <div className={estilos.sombra}>
      <article className={estilos.recibo}>
        <header className={estilos.cabeza}>
          <p className={estilos.acap}>
            <Notebook size={18} weight="duotone" aria-hidden /> {c.acap}
          </p>
          <h1 className={estilos.titulo}>{t("comprobante.miembro").replace("{n}", String(c.numero_miembro).padStart(2, "0"))}</h1>
          <p className={estilos.reunion}>{t("comprobante.reunion").replace("{n}", String(c.reunion)).replace("{fecha}", fecha(c.fecha))}</p>
          <p className={estilos.confirmado}>
            <CheckCircle size={18} weight="fill" aria-hidden /> {t("comprobante.confirmado")}
          </p>
        </header>
        <dl className={estilos.renglones}>
          {renglones.map(([etiqueta, pesos, sellos]) => (
            <div key={etiqueta} className={estilos.renglon}>
              <dt>
                {etiqueta}
                {sellos ? (
                  <span className={estilos.sellos} aria-hidden>
                    {Array.from({ length: Math.min(sellos, 10) }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                ) : null}
              </dt>
              <dd>{formatearPesos(pesos)}</dd>
            </div>
          ))}
          <div className={estilos.total}>
            <dt>Entregó en esta reunión</dt>
            <dd>{formatearPesos(total)}</dd>
          </div>
        </dl>
        <dl className={estilos.resumen}>
          <div>
            <dt>{t("comprobante.ahorroCiclo")}</dt>
            <dd>{formatearPesos(c.ahorro_ciclo)}</dd>
          </div>
          <div>
            <dt>{t("comprobante.saldoPrestamos")}</dt>
            <dd>{formatearPesos(c.saldo_prestamos)}</dd>
          </div>
        </dl>
        <footer className={estilos.pie}>
          <p>
            {t("comprobante.datosAl").replace("{fecha}", fecha(c.datos_al))} · {t("comprobante.venceEn").replace("{fecha}", fecha(c.vence_en))}
          </p>
          <p>{t("comprobante.noBanco")}</p>
        </footer>
      </article>
      </div>
    </main>
  );
}
