"use client";

// Usuarios de la oficina: el personal de la Fundación con su rol. Solo el administrador entra
// aquí. Los usuarios de la app de cada ACAP se crean en la ficha de su comunidad.

import { Plus, UserGear } from "@phosphor-icons/react";
import { useState } from "react";

import { Bloque, Cabecera, Cargando, Etiqueta, Lateral, Tabla, useDatos, useEnvio, modulo as m } from "../_panel/comunes";
import { Campo, Iniciales, Interruptor, Seccion, Selector, Vacio } from "../_panel/formas";
import estilos from "../_panel/tablero.module.css";

interface Usuario {
  id: string;
  usuario: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: string;
  activo: boolean;
  ultimo_ingreso: string | null;
}

interface Datos {
  usuarios: Usuario[];
  roles: { valor: string; texto: string; ayuda: string }[];
}

const VACIO = { usuario: "", nombres: "", apellidos: "", correo: "", rol: "Facilitador", activo: true, clave: "" };

const TONO: Record<string, "alerta" | "azul" | "bien" | "neutro"> = {
  Administrador: "alerta",
  "Coordinador territorial": "azul",
  Facilitador: "bien",
};

export default function Usuarios() {
  const { datos, error, recargar } = useDatos<Datos>("/oficina/usuarios");
  const { enviar, enviando, error: errorEnvio, setError } = useEnvio();
  const [editando, setEditando] = useState<Usuario | "nuevo" | null>(null);
  const [forma, setForma] = useState(VACIO);

  const abrir = (u: Usuario | "nuevo") => {
    setError(undefined);
    setEditando(u);
    setForma(u === "nuevo" ? VACIO : { ...u, clave: "" });
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = editando === "nuevo" ? await enviar("/oficina/usuarios", forma) : await enviar(`/oficina/usuarios/${(editando as Usuario).id}`, forma, "PUT");
    if (r) {
      setEditando(null);
      recargar();
    }
  };

  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Usuarios"
        sub="El personal de la Fundación que entra a este panel, con su rol."
        acciones={
          <button type="button" className={estilos.botonPrincipal} onClick={() => abrir("nuevo")}>
            <Plus size={16} weight="bold" aria-hidden /> Nuevo usuario
          </button>
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) =>
          d.usuarios.length === 0 ? (
            <Vacio icono={UserGear} titulo="Todavía no hay usuarios" texto="Cree el primero con «Nuevo usuario»." />
          ) : (
            <>
              <Bloque titulo="Personal con acceso" sub="Toque una persona para cambiar su rol, desactivarla o ponerle una clave nueva">
                <Tabla
                  filas={d.usuarios}
                  clave={(u) => u.id}
                  vacio=""
                  alElegir={abrir}
                  columnas={[
                    {
                      clave: "nombre",
                      titulo: "Persona",
                      orden: (u) => `${u.nombres} ${u.apellidos} ${u.usuario}`,
                      valor: (u) => (
                        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Iniciales texto={((u.nombres[0] ?? u.usuario[0]) + (u.apellidos[0] ?? "")).toUpperCase()} semilla={u.usuario.length} />
                          <span>
                            <span className={m.nombre}>{`${u.nombres} ${u.apellidos}`.trim() || u.usuario}</span>
                            <br />
                            <span className={m.tenue}>{u.usuario}</span>
                          </span>
                        </span>
                      ),
                    },
                    { clave: "rol", titulo: "Rol", orden: (u) => u.rol, valor: (u) => <Etiqueta tono={TONO[u.rol] ?? "neutro"}>{u.rol}</Etiqueta> },
                    { clave: "correo", titulo: "Correo", valor: (u) => <span className={m.tenue}>{u.correo || "—"}</span> },
                    {
                      clave: "ingreso",
                      titulo: "Último ingreso",
                      orden: (u) => u.ultimo_ingreso ?? "",
                      valor: (u) => (
                        <span className={m.tenue}>{u.ultimo_ingreso ? new Date(u.ultimo_ingreso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "Nunca"}</span>
                      ),
                    },
                    { clave: "estado", titulo: "Estado", valor: (u) => <Etiqueta tono={u.activo ? "bien" : "neutro"}>{u.activo ? "Activo" : "Desactivado"}</Etiqueta> },
                  ]}
                />
              </Bloque>
              <Bloque titulo="Qué puede hacer cada rol">
                <dl className={m.ficha}>
                  {d.roles.map((r) => (
                    <div key={r.valor}>
                      <dt>{r.texto}</dt>
                      <dd style={{ fontWeight: 400, color: "var(--texto-suave)", fontSize: "0.875rem" }}>{r.ayuda}</dd>
                    </div>
                  ))}
                </dl>
              </Bloque>
              <Lateral
                abierto={editando !== null}
                titulo={editando === "nuevo" ? "Nuevo usuario" : "Editar usuario"}
                descripcion="La clave se entrega en persona. La persona puede cambiarla después."
                alCerrar={() => setEditando(null)}
              >
                <form className={m.formulario} onSubmit={guardar}>
                  <Seccion titulo="Persona">
                    <div className={m.fila2}>
                      <Campo etiqueta="Nombres">
                        <input maxLength={150} value={forma.nombres} onChange={(e) => setForma({ ...forma, nombres: e.target.value })} />
                      </Campo>
                      <Campo etiqueta="Apellidos">
                        <input maxLength={150} value={forma.apellidos} onChange={(e) => setForma({ ...forma, apellidos: e.target.value })} />
                      </Campo>
                    </div>
                    <Campo etiqueta="Correo">
                      <input type="email" maxLength={254} value={forma.correo} onChange={(e) => setForma({ ...forma, correo: e.target.value })} />
                    </Campo>
                  </Seccion>
                  <Seccion titulo="Acceso">
                    <Campo etiqueta="Usuario" ayuda="Sin espacios; con él entra al panel.">
                      <input required autoComplete="off" disabled={editando !== "nuevo"} value={forma.usuario} onChange={(e) => setForma({ ...forma, usuario: e.target.value })} />
                    </Campo>
                    <Campo etiqueta={editando === "nuevo" ? "Clave inicial" : "Clave nueva (opcional)"} ayuda="12 caracteres o más.">
                      <input
                        type="password"
                        autoComplete="new-password"
                        required={editando === "nuevo"}
                        minLength={12}
                        value={forma.clave}
                        onChange={(e) => setForma({ ...forma, clave: e.target.value })}
                      />
                    </Campo>
                    <Campo etiqueta="Rol">
                      <Selector
                        valor={forma.rol}
                        opciones={d.roles.map((r) => ({ valor: r.valor, texto: r.texto, detalle: r.ayuda }))}
                        alCambiar={(rol) => setForma({ ...forma, rol })}
                      />
                    </Campo>
                    {editando !== "nuevo" ? <Interruptor etiqueta="Activo" ayuda="Un usuario desactivado no puede entrar." valor={forma.activo} alCambiar={(v) => setForma({ ...forma, activo: v })} /> : null}
                  </Seccion>
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
                      {enviando ? "Guardando…" : editando === "nuevo" ? "Crear usuario" : "Guardar"}
                    </button>
                  </div>
                </form>
              </Lateral>
            </>
          )
        }
      </Cargando>
    </main>
  );
}
