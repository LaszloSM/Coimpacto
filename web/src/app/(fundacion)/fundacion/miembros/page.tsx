"use client";

// Personas: el directorio de cada comunidad. Se elige la comunidad (o llega con ?acap=) y abajo
// queda su directorio completo para agregar, corregir, autorizar y retirar.

import { UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { Cabecera, Cargando, useDatos } from "../_panel/comunes";
import { Campo, Vacio } from "../_panel/formas";
import { Personas } from "../_panel/Personas";
import estilos from "../_panel/tablero.module.css";

export default function PaginaPersonas() {
  const { datos, error, recargar } = useDatos<{ id: string; nombre: string; miembros: number }[]>("/oficina/comunidades");
  // Desde la ficha de una comunidad llega ?acap=<id>; si no, la primera de la lista.
  const [elegida, setAcap] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("acap")));
  const acap = datos?.some((a) => a.id === elegida) ? elegida! : (datos?.[0]?.id ?? "");

  return (
    <main className={estilos.pagina}>
      <Cabecera titulo="Personas" sub="Los miembros de cada comunidad, con su autorización de datos y su perfil para los informes." />
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(lista) =>
          lista.length === 0 ? (
            <Vacio
              icono={UsersThree}
              titulo="Primero cree una comunidad"
              texto="Las personas pertenecen a una ACAP. Cree la comunidad y vuelva aquí para agregar a sus miembros."
              accion={
                <Link className={estilos.botonPrincipal} href="/fundacion/comunidades">
                  Ir a Comunidades
                </Link>
              }
            />
          ) : (
            <>
              <div style={{ maxWidth: 360, marginBottom: 20 }}>
                <Campo etiqueta="Comunidad">
                  <select value={acap} onChange={(e) => setAcap(e.target.value)}>
                    {lista.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} · {a.miembros} miembros
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              {acap ? <Personas key={acap} acapId={acap} alCambiar={recargar} /> : null}
            </>
          )
        }
      </Cargando>
    </main>
  );
}
