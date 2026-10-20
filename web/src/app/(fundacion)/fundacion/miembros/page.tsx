"use client";

// Miembros y autorización de datos (T8, D12 = A, Ley 1581). La facilitadora elige la ACAP, ve
// los miembros por número y da de alta con la foto del formato firmado o con huella. Sin
// autorización vigente solo se ve el número. Revocar suprime los datos y deja el evento.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { t } from "@/i18n";
import { api, SinSesion } from "@/lib/api";

import estilos from "../oficina.module.css";

interface Acap {
  id: string;
  nombre: string;
}

interface Miembro {
  id: string;
  numero: number;
  activo: boolean;
  nombre_corto: string | null;
  consentimiento: "vigente" | "revocado" | "falta";
  consentimiento_id: string | null;
  desde: string | null;
}

type Accion = { tipo: "alta" } | { tipo: "autorizar" | "revocar"; miembro: Miembro } | null;

const num = (n: number) => `#${String(n).padStart(2, "0")}`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

export default function Miembros() {
  const router = useRouter();
  const [acaps, setAcaps] = useState<Acap[] | null>(null);
  const [acap, setAcap] = useState("");
  const [miembros, setMiembros] = useState<Miembro[] | null>(null);
  const [accion, setAccion] = useState<Accion>(null);
  const [error, setError] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const fallo = useCallback(
    (e: unknown) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : setError(e instanceof Error ? e.message : String(e))),
    [router],
  );

  useEffect(() => {
    api<Acap[]>("/acaps")
      .then(setAcaps)
      .catch((e) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : setError(t("miembros.sinPermiso"))));
  }, [router]);

  const cargar = useCallback(
    (id: string) => {
      setMiembros(null);
      if (id) api<Miembro[]>(`/oficina/acaps/${id}/miembros`).then(setMiembros).catch(fallo);
    },
    [fallo],
  );

  const enviar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!accion) return;
    setEnviando(true);
    setError(undefined);
    const datos = new FormData(evento.currentTarget);
    const foto = datos.get("foto");
    if (foto instanceof File && foto.size === 0) datos.delete("foto");
    const ruta =
      accion.tipo === "alta"
        ? `/oficina/acaps/${acap}/miembros`
        : `/oficina/miembros/${accion.miembro.id}/${accion.tipo === "revocar" ? "revocar" : "consentimiento"}`;
    try {
      await api(ruta, { metodo: "POST", cuerpo: datos });
      setAviso(t(`miembros.listo.${accion.tipo}`));
      setAccion(null);
      cargar(acap);
    } catch (e) {
      fallo(e);
    } finally {
      setEnviando(false);
    }
  };

  const estado = (m: Miembro) =>
    m.consentimiento === "vigente"
      ? t("miembros.vigente").replace("{fecha}", fecha(m.desde!))
      : m.consentimiento === "revocado"
        ? t("miembros.revocado").replace("{fecha}", fecha(m.desde!))
        : t("miembros.falta");

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("miembros.titulo")}</h1>
      {error ? (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p className={estilos.listo} role="status">
          {aviso}
        </p>
      ) : null}
      {!acaps ? (
        <p className={estilos.detalle}>{t("miembros.cargando")}</p>
      ) : (
        <label className={estilos.etiqueta}>
          {t("miembros.acap")}
          <select
            className={estilos.campo}
            value={acap}
            onChange={(e) => {
              setAcap(e.target.value);
              setAccion(null);
              setAviso(undefined);
              cargar(e.target.value);
            }}
          >
            <option value="">{t("miembros.elegir")}</option>
            {acaps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {accion ? (
        <form className={`${estilos.formulario} ${estilos.bloque}`} onSubmit={enviar}>
          <h2 className={estilos.subtitulo}>
            {accion.tipo === "alta"
              ? t("miembros.alta")
              : `${t(accion.tipo === "revocar" ? "miembros.revocar" : "miembros.autorizar")} · ${num(accion.miembro.numero)}`}
          </h2>
          {accion.tipo === "revocar" ? (
            <>
              <p className={estilos.detalle}>{t("miembros.revocarDetalle")}</p>
              <label className={estilos.etiqueta}>
                {t("miembros.nota")}
                <input className={estilos.campo} name="nota" required maxLength={200} />
              </label>
              <label className={estilos.etiqueta}>
                {t("miembros.fotoOpcional")}
                <input className={estilos.campo} name="foto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" />
              </label>
            </>
          ) : (
            <>
              <label className={estilos.etiqueta}>
                {t("miembros.nombres")}
                <input className={estilos.campo} name="nombres" required maxLength={80} autoComplete="off" />
              </label>
              <label className={estilos.etiqueta}>
                {t("miembros.apellidos")}
                <input className={estilos.campo} name="apellidos" maxLength={80} autoComplete="off" />
              </label>
              <label className={estilos.etiqueta}>
                {t("miembros.documento")}
                <input className={estilos.campo} name="documento" inputMode="numeric" maxLength={20} autoComplete="off" />
              </label>
              <label className={estilos.etiqueta}>
                {t("miembros.telefono")}
                <input className={estilos.campo} name="telefono" type="tel" maxLength={20} autoComplete="off" />
              </label>
              <label className={estilos.etiqueta}>
                {t("miembros.foto")}
                <input
                  className={estilos.campo}
                  name="foto"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                />
              </label>
              <p className={estilos.detalle}>{t("miembros.fotoDetalle")}</p>
            </>
          )}
          <button className={estilos.principal} type="submit" disabled={enviando}>
            {enviando ? t("miembros.guardando") : t("miembros.guardar")}
          </button>
          <button className={estilos.secundario} type="button" onClick={() => setAccion(null)}>
            {t("miembros.cancelar")}
          </button>
        </form>
      ) : null}

      {miembros ? (
        <section aria-live="polite" className={estilos.bloque}>
          {!accion ? (
            <button className={estilos.secundario} type="button" onClick={() => setAccion({ tipo: "alta" })}>
              {t("miembros.alta")}
            </button>
          ) : null}
          {miembros.length === 0 ? (
            <p>{t("miembros.vacio")}</p>
          ) : (
            <ul className={estilos.lista}>
              {miembros.map((m) => (
                <li key={m.id} className={estilos.renglon} data-consentimiento={m.consentimiento}>
                  <strong>{[num(m.numero), m.nombre_corto].filter(Boolean).join(" ")}</strong>
                  <span>{estado(m)}</span>
                  <span className={estilos.acciones}>
                    {m.consentimiento === "vigente" ? (
                      <>
                        {m.consentimiento_id ? (
                          <a href={`/api/oficina/consentimientos/${m.consentimiento_id}/foto`} target="_blank" rel="noreferrer">
                            {t("miembros.verFoto")}
                          </a>
                        ) : null}
                        <button className={estilos.enlace} type="button" onClick={() => setAccion({ tipo: "revocar", miembro: m })}>
                          {t("miembros.revocar")}
                        </button>
                      </>
                    ) : (
                      <button className={estilos.enlace} type="button" onClick={() => setAccion({ tipo: "autorizar", miembro: m })}>
                        {t("miembros.autorizar")}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
