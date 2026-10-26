"use client";

// Armazón del panel de la Fundación: la barra de secciones sobre la mesa y, al lado, la hoja
// donde se trabaja. En pantallas angostas la barra pasa a un cajón. "Entrar" va sin barra.

import { Dialog } from "@base-ui/react/dialog";
import { GearSix, List, MagnifyingGlass, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import { api, SinSesion } from "@/lib/api";

import { Comandos } from "./_panel/Comandos";
import { activa, GESTION, SEGUIMIENTO, type Seccion } from "./_panel/secciones";
import estilos from "./panel.module.css";

interface Yo {
  usuario: string;
  nombre: string;
  rol: string;
  es_admin: boolean;
}

function Marca() {
  return (
    <Link href="/fundacion" className={estilos.marca} aria-label="Credimpacto, inicio del panel">
      <span className={estilos.marcaNombre}>
        Cred<span className={estilos.marcaI}>i</span>mpacto
      </span>
      <span className={estilos.marcaDe}>CoimpactoB</span>
    </Link>
  );
}

function Navegacion(props: { ruta: string; yo?: Yo; pendientes?: number; alIr?: () => void; alBuscar: () => void }) {
  const enlace = (s: Seccion) => {
    const actual = activa(s.ruta, props.ruta);
    const Icono = s.icono;
    return (
      <li key={s.ruta}>
        <Link href={s.ruta} className={estilos.enlace} aria-current={actual ? "page" : undefined} onClick={props.alIr}>
          <Icono size={18} weight={actual ? "fill" : "regular"} aria-hidden />
          <span>{s.texto}</span>
          {s.contador && props.pendientes ? (
            <span className={estilos.contador} aria-label={`${props.pendientes} pendientes`}>
              {props.pendientes}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };
  return (
    <>
      <Marca />
      <button type="button" className={estilos.buscar} onClick={props.alBuscar}>
        <MagnifyingGlass size={16} aria-hidden />
        <span>Buscar o ir a…</span>
        <kbd className={estilos.tecla}>Ctrl K</kbd>
      </button>
      <nav aria-label="Secciones del panel" className={estilos.navegacion}>
        <p className={estilos.grupo} id="grupo-seguimiento">
          Seguimiento
        </p>
        <ul aria-labelledby="grupo-seguimiento">{SEGUIMIENTO.map(enlace)}</ul>
        <p className={estilos.grupo} id="grupo-gestion">
          Gestión
        </p>
        <ul aria-labelledby="grupo-gestion">
          {GESTION.filter((s) => !s.soloAdmin || props.yo?.es_admin).map(enlace)}
          {props.yo?.es_admin ? (
            <li>
              <a href="/admin/" className={estilos.enlace}>
                <GearSix size={18} aria-hidden />
                <span>Configuración</span>
              </a>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
}

function Pie({ yo, alSalir }: { yo?: Yo; alSalir: () => void }) {
  const nombre = yo?.nombre || yo?.usuario || "";
  const iniciales =
    nombre
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "·";
  return (
    <div className={estilos.pie}>
      <span className={estilos.iniciales} aria-hidden>
        {iniciales}
      </span>
      <span className={estilos.usuario}>
        {nombre || "…"}
        {yo?.rol ? <span className={estilos.rol}>{yo.rol}</span> : null}
      </span>
      <button type="button" className={estilos.salir} onClick={alSalir} aria-label="Salir del panel" title="Salir del panel">
        <SignOut size={18} aria-hidden />
      </button>
    </div>
  );
}

export default function Armazon({ children }: Readonly<{ children: React.ReactNode }>) {
  const ruta = usePathname();
  const router = useRouter();
  const [yo, setYo] = useState<Yo>();
  const [pendientes, setPendientes] = useState<number>();
  const [buscando, setBuscando] = useState(false);
  const [menu, setMenu] = useState(false);
  const sinBarra = ruta === "/fundacion/entrar";

  useEffect(() => {
    if (sinBarra) return;
    api<Yo>("/sesion")
      .then(setYo)
      .catch((e) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : undefined));
    api<unknown[]>("/oficina/pendientes")
      .then((filas) => setPendientes(filas.length))
      .catch(() => setPendientes(undefined));
  }, [sinBarra, router]);

  if (sinBarra) return <div className={estilos.panel}>{children}</div>;

  const salir = async () => {
    await api("/sesion/salir", { metodo: "POST" }).catch(() => undefined);
    router.replace("/fundacion/entrar");
  };

  return (
    <div className={`${estilos.panel} ${estilos.armazon}`}>
      <aside className={estilos.barra}>
        <Navegacion ruta={ruta} yo={yo} pendientes={pendientes} alBuscar={() => setBuscando(true)} />
        <Pie yo={yo} alSalir={salir} />
      </aside>

      <header className={estilos.arriba}>
        <Marca />
        <Dialog.Root open={menu} onOpenChange={setMenu}>
          <Dialog.Trigger className={estilos.menu} aria-label="Abrir el menú de secciones">
            <List size={20} aria-hidden />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className={estilos.velo} />
            <Dialog.Popup className={`${estilos.panel} ${estilos.cajonNav}`} aria-label="Secciones del panel">
              <Dialog.Title className="oculto-visual">Secciones del panel</Dialog.Title>
              <Navegacion
                ruta={ruta}
                yo={yo}
                pendientes={pendientes}
                alIr={() => setMenu(false)}
                alBuscar={() => {
                  setMenu(false);
                  setBuscando(true);
                }}
              />
              <Pie yo={yo} alSalir={salir} />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      <div className={estilos.contenido}>
        <div className={estilos.hoja}>{children}</div>
      </div>

      <Comandos abierto={buscando} alCambiar={setBuscando} esAdmin={Boolean(yo?.es_admin)} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          unstyled: true,
          classNames: { toast: "aviso-panel", title: "aviso-panel-titulo", description: "aviso-panel-detalle" },
        }}
      />
    </div>
  );
}
