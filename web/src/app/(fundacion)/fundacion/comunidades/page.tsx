"use client";

// Comunidades: todas las ACAP con lo que les falta para operar (ciclo, junta, acceso a la app)
// y el alta de una nueva. Al tocar una fila se abre su ficha.

import { Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Bloque, Cabecera, Campo, Cargando, Cifras, Etiqueta, Lateral, Tabla, useDatos, useEnvio, modulo as m } from "../_panel/comunes";
import { pesosCortos } from "../_panel/formato";
import estilos from "../_panel/tablero.module.css";

interface ComunidadGestion {
  id: string;
  nombre: string;
  zona: string;
  departamento: string;
  municipio: string;
  ciclo: { numero: number; valor_accion: number; reuniones: number } | null;
  miembros: number;
  cargos: number;
  acceso_app: boolean;
  celulares: number;
}

function Listo({ ok, si, no }: { ok: boolean; si: string; no: string }) {
  return <Etiqueta tono={ok ? "bien" : "atencion"}>{ok ? si : no}</Etiqueta>;
}

export default function Comunidades() {
  const router = useRouter();
  const { datos, error, recargar } = useDatos<ComunidadGestion[]>("/oficina/comunidades");
  const { enviar, enviando, error: errorEnvio, setError } = useEnvio();
  const [abierto, setAbierto] = useState(false);
  const [forma, setForma] = useState({ nombre: "", zona: "", departamento: "", municipio: "" });
  const cambiar = (campo: keyof typeof forma) => (e: React.ChangeEvent<HTMLInputElement>) => setForma({ ...forma, [campo]: e.target.value });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await enviar("/oficina/comunidades", forma);
    if (r) router.push(`/fundacion/comunidades/${r.id as string}`);
  };

  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Comunidades"
        sub="Cada ACAP con su ciclo, su junta y el acceso de su celular."
        acciones={
          <button
            type="button"
            className={estilos.botonPrincipal}
            onClick={() => {
              setError(undefined);
              setAbierto(true);
            }}
          >
            <Plus size={16} weight="bold" aria-hidden /> Nueva comunidad
          </button>
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(d) => (
          <>
            <Cifras
              cifras={[
                { etiqueta: "Comunidades", valor: String(d.length), pie: `${d.filter((c) => c.ciclo).length} con ciclo activo`, destacada: true },
                { etiqueta: "Miembros", valor: d.reduce((s, c) => s + c.miembros, 0).toLocaleString("es-CO"), pie: "activos en todas las ACAP" },
                { etiqueta: "Con acceso a la app", valor: String(d.filter((c) => c.acceso_app).length), pie: "usuario de la junta creado" },
                { etiqueta: "Celulares", valor: String(d.reduce((s, c) => s + c.celulares, 0)), pie: "registrados y activos" },
              ]}
            />
            <Bloque titulo="Todas las comunidades" sub="Toque una comunidad para ver y cambiar su ficha">
              <Tabla
                filas={d}
                clave={(c) => c.id}
                vacio="Todavía no hay comunidades. Cree la primera con «Nueva comunidad»."
                alElegir={(c) => router.push(`/fundacion/comunidades/${c.id}`)}
                columnas={[
                  { clave: "nombre", titulo: "Comunidad", orden: (c) => c.nombre, valor: (c) => <><span className={m.nombre}>{c.nombre}</span><br /><span className={m.tenue}>{[c.municipio, c.departamento].filter(Boolean).join(", ") || "Sin ubicación"}</span></> },
                  { clave: "zona", titulo: "Zona", orden: (c) => c.zona, valor: (c) => c.zona || <span className={m.tenue}>Sin zona</span> },
                  { clave: "ciclo", titulo: "Ciclo", valor: (c) => (c.ciclo ? <span>Ciclo {c.ciclo.numero} · acción {pesosCortos(c.ciclo.valor_accion)}</span> : <Etiqueta tono="atencion">Sin ciclo</Etiqueta>) },
                  { clave: "miembros", titulo: "Miembros", numero: true, orden: (c) => c.miembros, valor: (c) => c.miembros },
                  { clave: "junta", titulo: "Junta", valor: (c) => <Listo ok={c.cargos >= 2} si={`${c.cargos} cargos`} no={c.cargos ? `${c.cargos} cargo` : "Sin junta"} /> },
                  { clave: "app", titulo: "App", valor: (c) => <Listo ok={c.acceso_app} si={c.celulares ? `${c.celulares} celular` : "Usuario listo"} no="Sin usuario" /> },
                ]}
              />
            </Bloque>
            <Lateral abierto={abierto} titulo="Nueva comunidad" alCerrar={() => setAbierto(false)}>
              <form className={m.formulario} onSubmit={guardar}>
                <Campo etiqueta="Nombre de la ACAP">
                  <input required maxLength={200} value={forma.nombre} onChange={cambiar("nombre")} />
                </Campo>
                <Campo etiqueta="Zona" ayuda="Agrupa las comunidades en el panel (por ejemplo Norte, Sur, Pacífico).">
                  <input maxLength={60} value={forma.zona} onChange={cambiar("zona")} />
                </Campo>
                <div className={m.fila2}>
                  <Campo etiqueta="Departamento">
                    <input maxLength={60} value={forma.departamento} onChange={cambiar("departamento")} />
                  </Campo>
                  <Campo etiqueta="Municipio">
                    <input maxLength={80} value={forma.municipio} onChange={cambiar("municipio")} />
                  </Campo>
                </div>
                {errorEnvio ? <p className={m.errorFormulario} role="alert">{errorEnvio}</p> : null}
                <div className={m.botonera}>
                  <button type="button" className={estilos.botonSecundario} onClick={() => setAbierto(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className={estilos.botonPrincipal} disabled={enviando}>
                    {enviando ? "Creando…" : "Crear y seguir"}
                  </button>
                </div>
              </form>
            </Lateral>
          </>
        )}
      </Cargando>
    </main>
  );
}
