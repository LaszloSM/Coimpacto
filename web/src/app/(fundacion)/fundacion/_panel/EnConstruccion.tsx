// Sección del panel que todavía no tiene módulo: dice qué va a mostrar y de dónde saldrá,
// sin cifras de ejemplo que parezcan reales.

import Link from "next/link";

import estilos from "./tablero.module.css";

export function EnConstruccion(props: { titulo: string; que: string; fuente: string }) {
  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabeza}>
        <div>
          <h1 className={estilos.titulo}>{props.titulo}</h1>
          <p className={estilos.subtitulo}>{props.que}</p>
        </div>
      </header>
      <section className={estilos.vacioGrande}>
        <h2>Este módulo llega en las próximas entregas</h2>
        <p>{props.fuente}</p>
        <Link className={estilos.botonSecundario} href="/fundacion">
          Volver al panel
        </Link>
      </section>
    </main>
  );
}
