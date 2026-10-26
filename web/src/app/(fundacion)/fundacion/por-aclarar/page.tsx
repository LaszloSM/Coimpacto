"use client";

// Registros por aclarar (D24, ET3): lo que se anotó, por qué no se aceptó y la propuesta del
// facilitador, que la junta acepta o no en el paso 2 de la siguiente reunión. La propuesta no
// cambia el libro hasta que la junta la firma.

import { formatearPesos } from "@credimpacto/reglas";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { t, type ClaveTexto } from "@/i18n";
import { api, SinSesion } from "@/lib/api";

import estilos from "../oficina.module.css";

interface Acap {
  id: string;
  nombre: string;
}

interface Propuesta {
  id: string;
  accion: "anular" | "dejar";
  motivo: string;
  estado: "pendiente" | "aceptada" | "no_aceptada";
  respuesta_motivo: string;
  respuesta_nota: string;
}

interface Registro {
  movimiento_id: string;
  tipo: string;
  monto: number;
  numero_miembro: number | null;
  reunion: number;
  fecha: string;
  estado: "en_conflicto" | "por_validar";
  codigo: string;
  propuesta: Propuesta | null;
}

const TIPOS = ["ahorro", "fondo_social", "multa", "abono", "desembolso", "venta", "faltante", "sobrante"];
const tipo = (x: string) => (TIPOS.includes(x) ? t(`porAclarar.tipos.${x}` as ClaveTexto) : x);
const fecha = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function PorAclarar() {
  const router = useRouter();
  const [acaps, setAcaps] = useState<Acap[] | null>(null);
  const [acap, setAcap] = useState("");
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const fallo = useCallback(
    (e: unknown) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : setError(e instanceof Error ? e.message : String(e))),
    [router],
  );

  useEffect(() => {
    api<Acap[]>("/acaps")
      .then(setAcaps)
      .catch((e) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : setError(t("porAclarar.sinPermiso"))));
  }, [router]);

  const cargar = useCallback(
    (id: string) => {
      setRegistros(null);
      if (id) api<Registro[]>(`/oficina/acaps/${id}/por-aclarar`).then(setRegistros).catch(fallo);
    },
    [fallo],
  );

  const proponer = async (evento: React.FormEvent<HTMLFormElement>, movimientoId: string) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(undefined);
    try {
      await api("/oficina/propuestas", {
        metodo: "POST",
        cuerpo: {
          movimiento_id: movimientoId,
          accion: datos.get("accion"),
          motivo: datos.get("motivo"),
        },
      });
      setAbierto(null);
      cargar(acap);
    } catch (e) {
      fallo(e);
    } finally {
      setEnviando(false);
    }
  };

  const estadoPropuesta = (p: Propuesta) =>
    p.estado === "pendiente"
      ? t("porAclarar.esperaJunta")
      : p.estado === "aceptada"
        ? t("porAclarar.aceptada")
        : `${t("porAclarar.noAceptada")}: ${p.respuesta_motivo}${p.respuesta_nota ? ` · «${p.respuesta_nota}»` : ""}`;

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("porAclarar.titulo")}</h1>
      <p className={estilos.detalle}>{t("porAclarar.detalle")}</p>
      {error ? (
        <p className={estilos.error} role="alert">
          {error}
        </p>
      ) : null}
      {acaps && acaps.length === 0 ? (
        <div className={estilos.vacio} role="status">
          <p>{t("armazon.sinAcap")}</p>
          <a href="/admin/acap/acap/add/">{t("armazon.irConfiguracion")}</a>
        </div>
      ) : acaps ? (
        <label className={`${estilos.etiqueta} ${estilos.bloque}`}>
          {t("porAclarar.acap")}
          <select
            className={estilos.campo}
            value={acap}
            onChange={(e) => {
              setAcap(e.target.value);
              setAbierto(null);
              cargar(e.target.value);
            }}
          >
            <option value="">{t("porAclarar.elegir")}</option>
            {acaps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {registros ? (
        registros.length === 0 ? (
          <p className={estilos.bloque}>{t("porAclarar.nada")}</p>
        ) : (
          <ul className={`${estilos.lista} ${estilos.bloque}`}>
            {registros.map((r) => {
              const puedeProponer = !r.propuesta || r.propuesta.estado === "no_aceptada";
              return (
                <li key={r.movimiento_id} className={estilos.renglon} data-tipo={r.estado}>
                  <strong>
                    {tipo(r.tipo)} · {formatearPesos(Math.abs(r.monto))}
                    {r.numero_miembro ? ` · #${String(r.numero_miembro).padStart(2, "0")}` : ""}
                  </strong>
                  <span>
                    {t("porAclarar.reunion").replace("{n}", String(r.reunion)).replace("{fecha}", fecha(r.fecha))} · {t(`fundacion.pendiente.${r.estado}`)}
                  </span>
                  {r.codigo ? <code className={estilos.codigo}>{r.codigo}</code> : null}
                  {r.propuesta ? (
                    <p className={estilos.detalle}>
                      {t(r.propuesta.accion === "anular" ? "porAclarar.anular" : "porAclarar.dejar")} · {estadoPropuesta(r.propuesta)}
                    </p>
                  ) : null}
                  {puedeProponer && abierto !== r.movimiento_id ? (
                    <span className={estilos.acciones}>
                      <button className={estilos.enlace} type="button" onClick={() => setAbierto(r.movimiento_id)}>
                        {t("porAclarar.proponer")}
                      </button>
                    </span>
                  ) : null}
                  {abierto === r.movimiento_id ? (
                    <form className={estilos.formulario} onSubmit={(e) => proponer(e, r.movimiento_id)}>
                      <fieldset className={estilos.opciones}>
                        <legend>{t("porAclarar.queProponer")}</legend>
                        <label>
                          <input type="radio" name="accion" value="anular" required /> {t("porAclarar.anular")}
                        </label>
                        <label>
                          <input type="radio" name="accion" value="dejar" /> {t("porAclarar.dejar")}
                        </label>
                      </fieldset>
                      <label className={estilos.etiqueta}>
                        {t("porAclarar.motivo")}
                        <textarea className={estilos.campo} name="motivo" required maxLength={300} rows={3} />
                      </label>
                      <p className={estilos.detalle}>{t("porAclarar.motivoDetalle")}</p>
                      <button className={estilos.principal} type="submit" disabled={enviando}>
                        {enviando ? t("porAclarar.enviando") : t("porAclarar.enviar")}
                      </button>
                      <button className={estilos.secundario} type="button" onClick={() => setAbierto(null)}>
                        {t("porAclarar.cancelar")}
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </main>
  );
}
