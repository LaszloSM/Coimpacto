// Oficina de la Fundación. Por ahora: registrar celulares (D18). La bandeja de pendientes (D2) y
// las demás secciones (D28) llegan después; los datos se cargan en /admin mientras tanto.
import Link from "next/link";

import { t } from "@/i18n";

import estilos from "../../inicio.module.css";

export default function Fundacion() {
  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("fundacion.titulo")}</h1>
      <ul className={estilos.opciones}>
        <li className={estilos.opcion}>
          <Link className={estilos.enlace} href="/fundacion/celulares">
            {t("fundacion.celulares")}
          </Link>
          <p className={estilos.detalle}>{t("fundacion.celularesDetalle")}</p>
        </li>
      </ul>
    </main>
  );
}
