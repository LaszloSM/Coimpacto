"use client";

// Registrar un celular (D18, TD1): la facilitadora elige la ACAP y muestra el QR de un solo
// uso, que vence a los 15 minutos. El celular lo lee en "Registrar este celular".

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { t } from "@/i18n";
import { api, cuentaRegresiva, SinSesion } from "@/lib/api";

import estilos from "../oficina.module.css";

interface Acap {
  id: string;
  nombre: string;
}

interface Codigo {
  codigo: string;
  qr: string;
  vence_en: string;
}

export default function Celulares() {
  const router = useRouter();
  const [acaps, setAcaps] = useState<Acap[] | null>(null);
  const [acap, setAcap] = useState("");
  const [codigo, setCodigo] = useState<Codigo | null>(null);
  const [svg, setSvg] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());
  const [error, setError] = useState<string>();
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    api<Acap[]>("/acaps")
      .then(setAcaps)
      .catch((e) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : setError(t("celulares.sinPermiso"))));
  }, [router]);

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);

  const generar = async () => {
    setGenerando(true);
    setError(undefined);
    try {
      const nuevo = await api<Codigo>("/enrolamiento/codigos", { metodo: "POST", cuerpo: { acap_id: acap } });
      setSvg(await QRCode.toString(nuevo.qr, { type: "svg", errorCorrectionLevel: "M", margin: 2 }));
      setCodigo(nuevo);
    } catch (e) {
      if (e instanceof SinSesion) router.replace("/fundacion/entrar");
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerando(false);
    }
  };

  const vencido = codigo ? Date.parse(codigo.vence_en) <= ahora : false;

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("celulares.titulo")}</h1>
      {error ? (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      ) : null}
      {!acaps ? (
        <p className={estilos.detalle}>{t("celulares.cargando")}</p>
      ) : (
        <div className={estilos.formulario}>
          <label className={estilos.etiqueta}>
            {t("celulares.acap")}
            <select className={estilos.campo} value={acap} onChange={(e) => setAcap(e.target.value)}>
              <option value="">{t("celulares.elegir")}</option>
              {acaps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
          {!codigo || vencido ? (
            <button className={estilos.principal} type="button" disabled={!acap || generando} onClick={generar}>
              {generando ? t("celulares.generando") : t("celulares.generar")}
            </button>
          ) : null}
        </div>
      )}
      {codigo ? (
        <section className={estilos.qr} aria-live="polite">
          {vencido ? (
            <p className={estilos.error}>{t("celulares.vencido")}</p>
          ) : (
            <>
              <p className={estilos.detalle}>{t("celulares.instrucciones")}</p>
              {/* SVG generado aquí mismo por la librería qrcode desde el texto del servidor. */}
              <div role="img" aria-label={t("celulares.titulo")} dangerouslySetInnerHTML={{ __html: svg }} />
              <p>
                {t("celulares.vence")} <span className={estilos.cifra}>{cuentaRegresiva(codigo.vence_en, ahora)}</span>
              </p>
              <p className={estilos.detalle}>{t("celulares.escrito")}</p>
              <p className={estilos.codigo}>{codigo.codigo}</p>
              <button className={estilos.secundario} type="button" onClick={() => setCodigo(null)}>
                {t("celulares.otro")}
              </button>
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
