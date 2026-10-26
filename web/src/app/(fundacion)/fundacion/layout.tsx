"use client";

// Armazón del panel de la Fundación: marca CoimpactoB (carbón, naranja #F66A03, Poppins y
// Roboto), barra lateral con las secciones del mockup y la gestión. "Entrar" va sin barra.

import {
  ChartLineUp,
  ChalkboardTeacher,
  ClipboardText,
  CoinVertical,
  FileText,
  GearSix,
  HandCoins,
  Lightbulb,
  ListChecks,
  MagnifyingGlass,
  Plant,
  SignOut,
  SquaresFour,
  Tray,
  UsersThree,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Poppins, Roboto } from "next/font/google";
import { useEffect, useState } from "react";

import { api, SinSesion } from "@/lib/api";

import estilos from "./panel.module.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--fuente-titulos" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--fuente-texto" });

interface Seccion {
  ruta: string;
  texto: string;
  icono: Icon;
  contador?: boolean;
}

const ANALISIS: Seccion[] = [
  { ruta: "/fundacion", texto: "Panel", icono: SquaresFour },
  { ruta: "/fundacion/ahorro", texto: "Ahorro", icono: CoinVertical },
  { ruta: "/fundacion/credito", texto: "Crédito", icono: HandCoins },
  { ruta: "/fundacion/cartera", texto: "Cartera", icono: Wallet },
  { ruta: "/fundacion/proyectos", texto: "Proyectos", icono: Plant },
  { ruta: "/fundacion/capacitaciones", texto: "Capacitaciones", icono: ChalkboardTeacher },
  { ruta: "/fundacion/analisis", texto: "Análisis", icono: Lightbulb },
  { ruta: "/fundacion/evaluaciones", texto: "Evaluaciones", icono: ListChecks },
  { ruta: "/fundacion/reportes", texto: "Reportes", icono: FileText },
];

const GESTION: Seccion[] = [
  { ruta: "/fundacion/comunidades", texto: "Comunidades", icono: ChartLineUp },
  { ruta: "/fundacion/miembros", texto: "Personas", icono: UsersThree },
  { ruta: "/fundacion/pendientes", texto: "Pendientes", icono: Tray, contador: true },
  { ruta: "/fundacion/por-aclarar", texto: "Por aclarar", icono: MagnifyingGlass },
  { ruta: "/fundacion/respaldos", texto: "Copias de seguridad", icono: ClipboardText },
];

export default function Armazon({ children }: Readonly<{ children: React.ReactNode }>) {
  const ruta = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<string>();
  const [pendientes, setPendientes] = useState<number>();
  const sinBarra = ruta === "/fundacion/entrar";

  useEffect(() => {
    if (sinBarra) return;
    api<{ usuario: string }>("/sesion")
      .then((yo) => setUsuario(yo.usuario))
      .catch((e) => (e instanceof SinSesion ? router.replace("/fundacion/entrar") : undefined));
    api<unknown[]>("/oficina/pendientes")
      .then((filas) => setPendientes(filas.length))
      .catch(() => setPendientes(undefined));
  }, [sinBarra, router]);

  const fuentes = `${poppins.variable} ${roboto.variable}`;
  if (sinBarra) return <div className={`${fuentes} ${estilos.panel}`}>{children}</div>;

  const salir = async () => {
    await api("/sesion/salir", { metodo: "POST" }).catch(() => undefined);
    router.replace("/fundacion/entrar");
  };

  const enlace = (s: Seccion) => {
    const activa = s.ruta === "/fundacion" ? ruta === s.ruta : ruta.startsWith(s.ruta);
    const Icono = s.icono;
    return (
      <li key={s.ruta}>
        <Link href={s.ruta} className={estilos.enlace} aria-current={activa ? "page" : undefined}>
          <Icono size={20} weight={activa ? "fill" : "regular"} aria-hidden />
          <span>{s.texto}</span>
          {s.contador && pendientes ? <span className={estilos.contador}>{pendientes}</span> : null}
        </Link>
      </li>
    );
  };

  return (
    <div className={`${fuentes} ${estilos.panel} ${estilos.armazon}`}>
      <aside className={estilos.barra}>
        <Link href="/fundacion" className={estilos.marca} aria-label="Credimpacto, inicio del panel">
          Cred<span className={estilos.marcaI}>i</span>mpacto
        </Link>
        <nav aria-label="Secciones del panel" className={estilos.navegacion}>
          <p className={estilos.grupo} id="grupo-analisis">
            Análisis
          </p>
          <ul aria-labelledby="grupo-analisis">{ANALISIS.map(enlace)}</ul>
          <p className={estilos.grupo} id="grupo-gestion">
            Gestión
          </p>
          <ul aria-labelledby="grupo-gestion">
            {GESTION.map(enlace)}
            <li>
              <a href="/admin/" className={estilos.enlace}>
                <GearSix size={20} aria-hidden />
                <span>Configuración</span>
              </a>
            </li>
          </ul>
        </nav>
        <div className={estilos.pie}>
          <span className={estilos.iniciales} aria-hidden>
            {(usuario ?? "·").slice(0, 2).toUpperCase()}
          </span>
          <span className={estilos.usuario}>{usuario ?? "…"}</span>
          <button type="button" className={estilos.salir} onClick={salir} aria-label="Salir del panel">
            <SignOut size={20} aria-hidden />
          </button>
        </div>
      </aside>
      <div className={estilos.contenido}>{children}</div>
    </div>
  );
}
