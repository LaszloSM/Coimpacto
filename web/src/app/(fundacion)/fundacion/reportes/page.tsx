"use client";

// Reportes: el consolidado de la Fundación en Excel (para donantes, aliados y la junta
// directiva) y la versión para imprimir de cada módulo. Sin datos personales.

import { DownloadSimple, FileXls, Printer } from "@phosphor-icons/react";
import Link from "next/link";

import { Bloque, Cabecera, modulo as m } from "../_panel/comunes";
import estilos from "../_panel/tablero.module.css";

const HOJAS = [
  ["Resumen", "Ahorro, fondo social, multas, préstamos, cartera y mora a la fecha de corte."],
  ["Ahorro por ACAP", "Ciclo, reuniones, miembros, ahorro, meta y participación de cada comunidad."],
  ["Ahorro mensual", "Acciones, fondo social y multas de los últimos 12 meses."],
  ["Cartera por ACAP", "Préstamos vigentes, en mora, saldo, vencida e índice de mora."],
  ["Préstamos vigentes", "Cada préstamo por comunidad y número de miembro, con su atraso."],
  ["Reuniones", "Todas las reuniones con lo que entró y salió en cada una."],
];

const IMPRIMIBLES = [
  { ruta: "/fundacion", texto: "Panel de gerencia" },
  { ruta: "/fundacion/ahorro", texto: "Ahorro" },
  { ruta: "/fundacion/credito", texto: "Crédito" },
  { ruta: "/fundacion/cartera", texto: "Cartera" },
  { ruta: "/fundacion/analisis", texto: "Análisis" },
];

export default function Reportes() {
  return (
    <main className={estilos.pagina}>
      <Cabecera titulo="Reportes" sub="Información lista para compartir, sin nombres ni documentos de las personas." />
      <Bloque
        titulo="Consolidado de la Fundación"
        sub="Un archivo de Excel con seis hojas, calculado en el momento de descargarlo"
        acciones={
          <a className={estilos.botonPrincipal} href="/api/oficina/reportes/consolidado.xlsx">
            <DownloadSimple size={16} aria-hidden /> Descargar Excel
          </a>
        }
      >
        <ul className={m.tarjetas}>
          {HOJAS.map(([titulo, texto]) => (
            <li key={titulo} className={m.lectura} data-tono="neutro">
              <FileXls size={22} aria-hidden />
              <div>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </Bloque>
      <Bloque titulo="Para imprimir o guardar en PDF" sub="Abra el módulo y use Imprimir del navegador (Ctrl + P); la barra lateral no sale en la hoja">
        <div className={m.acciones}>
          {IMPRIMIBLES.map((i) => (
            <Link key={i.ruta} className={estilos.botonSecundario} href={i.ruta}>
              <Printer size={16} aria-hidden /> {i.texto}
            </Link>
          ))}
        </div>
      </Bloque>
    </main>
  );
}
