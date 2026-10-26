"use client";

// Cargos de la junta: el catálogo que usan todas las comunidades. Cada cargo marca lo que puede
// hacer (matriz de permisos); un cargo nuevo llega a los celulares en la siguiente
// sincronización, sin actualizar la app ni el servidor.

import { IdentificationBadge, Plus } from "@phosphor-icons/react";
import { useState } from "react";

import { Bloque, Cabecera, Cargando, Lateral, useDatos, useEnvio, modulo as m } from "../_panel/comunes";
import { Campo, Interruptor, Vacio } from "../_panel/formas";
import c from "../_panel/cargos.module.css";
import estilos from "../_panel/tablero.module.css";

interface TipoCargo {
  clave: string;
  nombre: string;
  descripcion: string;
  orden: number;
  activo: boolean;
  autoriza_altas: boolean;
  lleva_reunion: boolean;
  firma_prestamos: boolean;
  firma_cierre: boolean;
  en_uso: number;
}

type Permiso = "autoriza_altas" | "lleva_reunion" | "firma_prestamos" | "firma_cierre";

const PERMISOS: { clave: Permiso; texto: string; ayuda: string }[] = [
  {
    clave: "lleva_reunion",
    texto: "Lleva la reunión",
    ayuda: "Abre la reunión en el celular y registra aportes, multas y abonos.",
  },
  {
    clave: "firma_prestamos",
    texto: "Firma préstamos",
    ayuda: "Es una de las dos firmas de cargos distintos que aprueban un préstamo.",
  },
  {
    clave: "firma_cierre",
    texto: "Firma el cierre",
    ayuda: "Firma el cierre de la reunión después del arqueo.",
  },
  {
    clave: "autoriza_altas",
    texto: "Autoriza altas",
    ayuda: "Registra el celular con su PIN y da de alta a los demás cargos.",
  },
];

const VACIO = {
  nombre: "",
  descripcion: "",
  orden: 10,
  activo: true,
  autoriza_altas: false,
  lleva_reunion: true,
  firma_prestamos: true,
  firma_cierre: true,
};

export default function Cargos() {
  const { datos, error, recargar } = useDatos<TipoCargo[]>("/oficina/tipos-cargo");
  const { enviar, enviando, error: errorEnvio, setError } = useEnvio();
  const [editando, setEditando] = useState<TipoCargo | "nuevo" | null>(null);
  const [forma, setForma] = useState(VACIO);
  const [aviso, setAviso] = useState<string>();

  const abrir = (t: TipoCargo | "nuevo") => {
    setError(undefined);
    setEditando(t);
    setForma(t === "nuevo" ? { ...VACIO, orden: (datos?.length ?? 0) + 1 } : { ...t });
  };

  // Cambiar un permiso desde la matriz guarda de una vez.
  const alternar = async (t: TipoCargo, permiso: Permiso, valor: boolean) => {
    setAviso(undefined);
    const r = await enviar(`/oficina/tipos-cargo/${t.clave}`, { ...t, [permiso]: valor }, "PUT");
    if (r) recargar();
    else setAviso("No se pudo cambiar: al menos un cargo activo debe autorizar las altas.");
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r =
      editando === "nuevo" ? await enviar("/oficina/tipos-cargo", forma) : await enviar(`/oficina/tipos-cargo/${(editando as TipoCargo).clave}`, forma, "PUT");
    if (r) {
      setEditando(null);
      recargar();
    }
  };

  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Cargos de la junta"
        sub="Qué puede hacer cada cargo en el celular de la reunión. Vale para todas las comunidades."
        acciones={
          <button type="button" className={estilos.botonPrincipal} onClick={() => abrir("nuevo")}>
            <Plus size={16} weight="bold" aria-hidden /> Nuevo cargo
          </button>
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) =>
          d.length === 0 ? (
            <Vacio icono={IdentificationBadge} titulo="No hay cargos" texto="Cree el primero con «Nuevo cargo»." />
          ) : (
            <Bloque titulo="Permisos por cargo" sub="Toque un interruptor para cambiar el permiso; toque el nombre para editar el cargo">
              {aviso ? (
                <p className={m.errorFormulario} role="alert" style={{ marginBottom: 12 }}>
                  {aviso}
                </p>
              ) : null}
              <div className={c.matrizMarco}>
                <table className={c.matriz}>
                  <thead>
                    <tr>
                      <th scope="col">Cargo</th>
                      {PERMISOS.map((p) => (
                        <th key={p.clave} scope="col" title={p.ayuda}>
                          {p.texto}
                        </th>
                      ))}
                      <th scope="col" className={c.numero}>
                        En uso
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.map((t) => (
                      <tr key={t.clave} data-inactivo={!t.activo || undefined}>
                        <th scope="row">
                          <button type="button" className={c.nombre} onClick={() => abrir(t)}>
                            <span>{t.nombre}</span>
                            <span className={c.descripcion}>{t.activo ? t.descripcion || "Sin descripción" : "Inactivo: no se puede asignar"}</span>
                          </button>
                        </th>
                        {PERMISOS.map((p) => (
                          <td key={p.clave}>
                            <Interruptor
                              compacto
                              etiqueta={`${p.texto}: ${t.nombre}`}
                              valor={t[p.clave]}
                              deshabilitado={enviando || !t.activo}
                              alCambiar={(v) => void alternar(t, p.clave, v)}
                            />
                          </td>
                        ))}
                        <td className={c.numero}>{t.en_uso ? `${t.en_uso} ${t.en_uso === 1 ? "persona" : "personas"}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className={c.leyenda}>
                {PERMISOS.map((p) => (
                  <div key={p.clave}>
                    <dt>{p.texto}</dt>
                    <dd>{p.ayuda}</dd>
                  </div>
                ))}
              </dl>
            </Bloque>
          )
        }
      </Cargando>
      <Lateral
        abierto={editando !== null}
        titulo={editando === "nuevo" ? "Nuevo cargo" : "Editar cargo"}
        descripcion="Llega a los celulares en la siguiente sincronización; no hay que actualizar la app."
        alCerrar={() => setEditando(null)}
      >
        <form className={m.formulario} onSubmit={guardar}>
          <Campo etiqueta="Nombre del cargo" ayuda="Como lo dicen en la comunidad, por ejemplo «Fiscal» o «Secretaria».">
            <input required maxLength={60} value={forma.nombre} onChange={(e) => setForma({ ...forma, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Qué hace">
            <input maxLength={200} value={forma.descripcion} onChange={(e) => setForma({ ...forma, descripcion: e.target.value })} />
          </Campo>
          <Campo etiqueta="Orden en las listas">
            <input type="number" min={0} max={99} value={forma.orden} onChange={(e) => setForma({ ...forma, orden: Number(e.target.value) })} />
          </Campo>
          <div>
            {PERMISOS.map((p) => (
              <Interruptor key={p.clave} etiqueta={p.texto} ayuda={p.ayuda} valor={forma[p.clave]} alCambiar={(v) => setForma({ ...forma, [p.clave]: v })} />
            ))}
            <Interruptor
              etiqueta="Activo"
              ayuda="Un cargo inactivo no se puede asignar en los ciclos nuevos."
              valor={forma.activo}
              alCambiar={(v) => setForma({ ...forma, activo: v })}
            />
          </div>
          {errorEnvio ? (
            <p className={m.errorFormulario} role="alert">
              {errorEnvio}
            </p>
          ) : null}
          <div className={m.botonera}>
            <button type="button" className={estilos.botonSecundario} onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button type="submit" className={estilos.botonPrincipal} disabled={enviando}>
              {enviando ? "Guardando…" : editando === "nuevo" ? "Crear cargo" : "Guardar"}
            </button>
          </div>
        </form>
      </Lateral>
    </main>
  );
}
