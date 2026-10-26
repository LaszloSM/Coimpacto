// Las secciones del panel, en el orden de la barra. La barra, el menú de pantallas angostas y el
// buscador (Ctrl K) leen esta misma lista.

import {
  ChalkboardTeacher,
  ChartLineUp,
  CloudArrowUp,
  CoinVertical,
  FileText,
  HandCoins,
  IdentificationBadge,
  Lightbulb,
  ListChecks,
  MagnifyingGlass,
  Plant,
  SquaresFour,
  Tray,
  UserGear,
  UsersThree,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";

export interface Seccion {
  ruta: string;
  texto: string;
  icono: Icon;
  /** Palabras extra para el buscador. */
  claves?: string;
  contador?: boolean;
  soloAdmin?: boolean;
}

export const SEGUIMIENTO: Seccion[] = [
  { ruta: "/fundacion", texto: "Panel", icono: SquaresFour, claves: "inicio resumen tablero gerencia" },
  { ruta: "/fundacion/ahorro", texto: "Ahorro", icono: CoinVertical, claves: "acciones fondo social multas" },
  { ruta: "/fundacion/credito", texto: "Crédito", icono: HandCoins, claves: "préstamos desembolsos" },
  { ruta: "/fundacion/cartera", texto: "Cartera", icono: Wallet, claves: "mora saldos vencida" },
  { ruta: "/fundacion/proyectos", texto: "Proyectos", icono: Plant, claves: "productivos emprendimientos" },
  { ruta: "/fundacion/capacitaciones", texto: "Capacitaciones", icono: ChalkboardTeacher, claves: "talleres formación" },
  { ruta: "/fundacion/analisis", texto: "Análisis", icono: Lightbulb, claves: "lecturas tramos" },
  { ruta: "/fundacion/evaluaciones", texto: "Evaluaciones", icono: ListChecks, claves: "visitas puntaje" },
  { ruta: "/fundacion/reportes", texto: "Reportes", icono: FileText, claves: "excel descargar informes" },
];

export const GESTION: Seccion[] = [
  { ruta: "/fundacion/comunidades", texto: "Comunidades", icono: ChartLineUp, claves: "acap ficha ciclo junta" },
  { ruta: "/fundacion/miembros", texto: "Personas", icono: UsersThree, claves: "miembros socios autorización" },
  { ruta: "/fundacion/cargos", texto: "Cargos", icono: IdentificationBadge, claves: "permisos junta presidente" },
  { ruta: "/fundacion/pendientes", texto: "Pendientes", icono: Tray, contador: true, claves: "bandeja revisar sin datos" },
  { ruta: "/fundacion/por-aclarar", texto: "Por aclarar", icono: MagnifyingGlass, claves: "conflictos propuestas" },
  { ruta: "/fundacion/respaldos", texto: "Copias de seguridad", icono: CloudArrowUp, claves: "respaldo archivo subir" },
  { ruta: "/fundacion/usuarios", texto: "Usuarios", icono: UserGear, soloAdmin: true, claves: "personal roles claves" },
];

export function activa(ruta: string, actual: string) {
  return ruta === "/fundacion" ? actual === ruta : actual === ruta || actual.startsWith(`${ruta}/`);
}
