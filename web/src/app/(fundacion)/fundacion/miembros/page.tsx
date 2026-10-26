"use client";

// Personas: el directorio de cada comunidad. La comunidad se elige arriba (o llega con ?acap=)
// y abajo queda su lista para agregar, corregir, autorizar y retirar.

import { UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Cabecera, Cargando, useDatos } from "../_panel/comunes";
import { Selector, Vacio } from "../_panel/formas";
import { Personas } from "../_panel/Personas";
import estilos from "../_panel/tablero.module.css";

export default function PaginaPersonas() {
  const router = useRouter();
  const { datos, error, recargar } = useDatos<{ id: string; nombre: string; miembros: number; municipio: string }[]>("/oficina/comunidades");
  // Desde la ficha de una comunidad llega ?acap=<id>; si no, la primera de la lista.
  const [elegida, setAcap] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("acap")));
  const acap = datos?.some((a) => a.id === elegida) ? elegida! : (datos?.[0]?.id ?? "");

  const elegir = (id: string) => {
    setAcap(id);
    router.replace(`/fundacion/miembros?acap=${id}`, { scroll: false });
  };

  return (
    <main className={estilos.pagina}>
      <Cabecera
        titulo="Personas"
        sub="Los miembros de cada comunidad con su número del cuaderno, su autorización de datos y su perfil para los informes."
        acciones={
          datos && datos.length > 0 ? (
            <div style={{ minWidth: 260 }}>
              <Selector
                etiqueta="Comunidad"
                valor={acap}
                alCambiar={elegir}
                opciones={datos.map((a) => ({
                  valor: a.id,
                  texto: a.nombre,
                  detalle: `${a.miembros} ${a.miembros === 1 ? "miembro" : "miembros"}${a.municipio ? ` · ${a.municipio}` : ""}`,
                }))}
              />
            </div>
          ) : null
        }
      />
      <Cargando datos={datos} error={error} recargar={recargar} forma="lista">
        {(lista) =>
          lista.length === 0 ? (
            <Vacio
              icono={UsersThree}
              fantasma="tabla"
              titulo="Primero cree una comunidad"
              texto="Las personas pertenecen a una ACAP. Cree la comunidad y vuelva aquí para agregar a sus miembros."
              accion={
                <Link className={estilos.botonPrincipal} href="/fundacion/comunidades">
                  Ir a Comunidades
                </Link>
              }
            />
          ) : acap ? (
            <Personas key={acap} acapId={acap} alCambiar={recargar} />
          ) : null
        }
      </Cargando>
    </main>
  );
}
