"use client";

// Registros por aclarar (D24, ET3): lo que se anotó, por qué no se aceptó y la propuesta del
// facilitador, que la junta acepta o no en el paso 2 de la siguiente reunión. La propuesta no
// cambia el libro hasta que la junta la firma.

import { formatearPesos } from "@credimpacto/reglas";
import { ChatCircleText, CheckCircle, MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { t, type ClaveTexto } from "@/i18n";
import { api } from "@/lib/api";

import { Cabecera, Cargando, Etiqueta, Lateral, useDatos, modulo as m } from "../_panel/comunes";
import { Campo, Segmentado, Selector, Vacio } from "../_panel/formas";
import b from "../_panel/bandeja.module.css";
import estilos from "../_panel/tablero.module.css";

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

function estadoPropuesta(p: Propuesta) {
  return p.estado === "pendiente"
    ? t("porAclarar.esperaJunta")
    : p.estado === "aceptada"
      ? t("porAclarar.aceptada")
      : `${t("porAclarar.noAceptada")}: ${p.respuesta_motivo}${p.respuesta_nota ? ` · «${p.respuesta_nota}»` : ""}`;
}

function Registros({ acapId }: { acapId: string }) {
  const { datos, error, recargar } = useDatos<Registro[]>(`/oficina/acaps/${acapId}/por-aclarar`);
  const [abierto, setAbierto] = useState<Registro | null>(null);
  const [accion, setAccion] = useState<"anular" | "dejar">("anular");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState<string>();

  const abrir = (r: Registro) => {
    setAbierto(r);
    setAccion("anular");
    setMotivo("");
    setFalla(undefined);
  };

  const proponer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abierto) return;
    setEnviando(true);
    setFalla(undefined);
    try {
      await api("/oficina/propuestas", { metodo: "POST", cuerpo: { movimiento_id: abierto.movimiento_id, accion, motivo } });
      setAbierto(null);
      recargar();
      toast.success("Propuesta enviada", { description: "La junta la lee y la firma en el paso 2 de su próxima reunión." });
    } catch (x) {
      setFalla(x instanceof Error ? x.message : "No se pudo enviar la propuesta.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Cargando datos={datos} error={error} recargar={recargar} forma="lista">
      {(registros) =>
        registros.length === 0 ? (
          <Vacio icono={CheckCircle} titulo={t("porAclarar.nada")} texto="Cuando un registro de esta comunidad no cuadre con el libro, aparece aquí para proponer qué hacer." />
        ) : (
          <>
            <ol className={b.bandeja}>
              {registros.map((r, i) => {
                const puedeProponer = !r.propuesta || r.propuesta.estado === "no_aceptada";
                return (
                  <li key={r.movimiento_id} style={{ "--i": i } as React.CSSProperties}>
                    <article className={b.registro} data-estado={r.estado}>
                      <div className={b.registroCabeza}>
                        <div>
                          <p className={b.monto}>
                            {`${tipo(r.tipo)} · ${formatearPesos(Math.abs(r.monto))}${r.numero_miembro ? ` · #${String(r.numero_miembro).padStart(2, "0")}` : ""}`}
                          </p>
                          <p className={b.meta} style={{ margin: "4px 0 0" }}>
                            {t("porAclarar.reunion").replace("{n}", String(r.reunion)).replace("{fecha}", fecha(r.fecha))}
                            <Etiqueta tono={r.estado === "en_conflicto" ? "alerta" : "atencion"}>{t(`fundacion.pendiente.${r.estado}`)}</Etiqueta>
                            {r.codigo ? <code className={b.codigo}>{r.codigo}</code> : null}
                          </p>
                        </div>
                        {puedeProponer ? (
                          <button type="button" className={estilos.botonSecundario} onClick={() => abrir(r)}>
                            <ChatCircleText size={16} aria-hidden /> {t("porAclarar.proponer")}
                          </button>
                        ) : null}
                      </div>
                      {r.propuesta ? (
                        <div className={b.propuesta}>
                          <span>
                            Propuesta: <strong>{t(r.propuesta.accion === "anular" ? "porAclarar.anular" : "porAclarar.dejar")}</strong>
                          </span>
                          <Etiqueta tono={r.propuesta.estado === "aceptada" ? "bien" : r.propuesta.estado === "pendiente" ? "azul" : "atencion"}>
                            {estadoPropuesta(r.propuesta)}
                          </Etiqueta>
                        </div>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ol>
            <Lateral
              abierto={abierto !== null}
              titulo={t("porAclarar.proponer")}
              descripcion="Nada cambia en el libro hasta que la junta lo firme en su próxima reunión."
              alCerrar={() => setAbierto(null)}
            >
              {abierto ? (
                <form className={m.formulario} onSubmit={proponer}>
                  <div className={b.resumenRegistro}>
                    <span>Lo que se anotó</span>
                    <strong>
                      {tipo(abierto.tipo)} · {formatearPesos(Math.abs(abierto.monto))}
                      {abierto.numero_miembro ? ` · #${String(abierto.numero_miembro).padStart(2, "0")}` : ""}
                    </strong>
                    <span>{t("porAclarar.reunion").replace("{n}", String(abierto.reunion)).replace("{fecha}", fecha(abierto.fecha))}</span>
                  </div>
                  <Segmentado
                    etiqueta={t("porAclarar.queProponer")}
                    valor={accion}
                    alCambiar={setAccion}
                    opciones={[
                      { valor: "anular", texto: t("porAclarar.anular") },
                      { valor: "dejar", texto: t("porAclarar.dejar") },
                    ]}
                  />
                  <Campo etiqueta={t("porAclarar.motivo")} ayuda={t("porAclarar.motivoDetalle")}>
                    <textarea required maxLength={300} rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  </Campo>
                  {falla ? (
                    <p className={m.errorFormulario} role="alert">
                      {falla}
                    </p>
                  ) : null}
                  <div className={m.botonera}>
                    <button type="button" className={estilos.botonSecundario} onClick={() => setAbierto(null)}>
                      {t("porAclarar.cancelar")}
                    </button>
                    <button type="submit" className={estilos.botonPrincipal} disabled={enviando}>
                      {enviando ? t("porAclarar.enviando") : t("porAclarar.enviar")}
                    </button>
                  </div>
                </form>
              ) : null}
            </Lateral>
          </>
        )
      }
    </Cargando>
  );
}

export default function PorAclarar() {
  const router = useRouter();
  const { datos: acaps, error, recargar } = useDatos<Acap[]>("/acaps");
  const [elegida, setElegida] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("acap")));
  const acap = acaps?.some((a) => a.id === elegida) ? elegida! : (acaps?.[0]?.id ?? "");

  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo={t("porAclarar.titulo")}
        sub={t("porAclarar.detalle")}
        acciones={
          acaps && acaps.length > 0 ? (
            <div style={{ minWidth: 240 }}>
              <Selector
                etiqueta={t("porAclarar.acap")}
                valor={acap}
                opciones={acaps.map((a) => ({ valor: a.id, texto: a.nombre }))}
                alCambiar={(id) => {
                  setElegida(id);
                  router.replace(`/fundacion/por-aclarar?acap=${id}`, { scroll: false });
                }}
              />
            </div>
          ) : null
        }
      />
      <Cargando datos={acaps} error={error} recargar={recargar} forma="lista">
        {(lista) =>
          lista.length === 0 ? (
            <Vacio icono={MagnifyingGlass} titulo={t("armazon.sinAcap")} texto="Cree la primera comunidad para revisar sus registros." />
          ) : acap ? (
            <Registros key={acap} acapId={acap} />
          ) : null
        }
      </Cargando>
    </main>
  );
}
