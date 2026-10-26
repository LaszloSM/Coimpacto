"use client";

// Buscador del panel (Ctrl K o ⌘K): ir a cualquier sección o a la ficha de una comunidad sin
// soltar el teclado. Se abre y se cierra sin animación: se usa muchas veces al día.

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, Buildings, MagnifyingGlass } from "@phosphor-icons/react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

import c from "./comandos.module.css";
import { GESTION, SEGUIMIENTO, type Seccion } from "./secciones";

export function Comandos(props: { abierto: boolean; alCambiar: (abierto: boolean) => void; esAdmin: boolean }) {
  const router = useRouter();
  const [comunidades, setComunidades] = useState<{ id: string; nombre: string; municipio: string }[]>();
  const { abierto, alCambiar } = props;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        alCambiar(!abierto);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierto, alCambiar]);

  useEffect(() => {
    if (!abierto || comunidades) return;
    api<{ id: string; nombre: string; municipio: string }[]>("/oficina/comunidades")
      .then(setComunidades)
      .catch(() => setComunidades([]));
  }, [abierto, comunidades]);

  const ir = (ruta: string) => {
    alCambiar(false);
    router.push(ruta);
  };

  const grupo = (titulo: string, lista: Seccion[]) => (
    <Command.Group heading={titulo} className={c.grupo}>
      {lista
        .filter((s) => !s.soloAdmin || props.esAdmin)
        .map((s) => {
          const Icono = s.icono;
          return (
            <Command.Item key={s.ruta} value={`${s.texto} ${s.claves ?? ""}`} onSelect={() => ir(s.ruta)} className={c.opcion}>
              <Icono size={18} aria-hidden />
              <span>{s.texto}</span>
              <ArrowRight size={14} className={c.ir} aria-hidden />
            </Command.Item>
          );
        })}
    </Command.Group>
  );

  return (
    <Dialog.Root open={abierto} onOpenChange={alCambiar}>
      <Dialog.Portal>
        <Dialog.Backdrop className={c.velo} />
        <Dialog.Popup className={c.ventana} aria-label="Buscar en el panel">
          <Dialog.Title className={c.oculto}>Buscar en el panel</Dialog.Title>
          <Command label="Buscar en el panel" loop>
            <div className={c.entrada}>
              <MagnifyingGlass size={18} aria-hidden />
              <Command.Input autoFocus placeholder="Ir a una sección o a una comunidad…" />
              <kbd className={c.tecla}>Esc</kbd>
            </div>
            <Command.List className={c.lista}>
              <Command.Empty className={c.vacio}>Nada coincide. Pruebe con el nombre de la comunidad o de la sección.</Command.Empty>
              {grupo("Seguimiento", SEGUIMIENTO)}
              {grupo("Gestión", GESTION)}
              {comunidades?.length ? (
                <Command.Group heading="Comunidades" className={c.grupo}>
                  {comunidades.map((x) => (
                    <Command.Item
                      key={x.id}
                      value={`comunidad ${x.nombre} ${x.municipio}`}
                      onSelect={() => ir(`/fundacion/comunidades/${x.id}`)}
                      className={c.opcion}
                    >
                      <Buildings size={18} aria-hidden />
                      <span>{x.nombre}</span>
                      {x.municipio ? <span className={c.detalle}>{x.municipio}</span> : null}
                      <ArrowRight size={14} className={c.ir} aria-hidden />
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
