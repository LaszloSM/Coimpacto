import Link from "next/link";
import { t } from "@/i18n";
import estilos from "./inicio.module.css";

// La web es la plataforma de la Fundación; la reunión de la junta vive en la app Android.
export default function Inicio() {
  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("inicio.titulo")}</h1>
      <ul className={estilos.opciones}>
        <li className={estilos.opcion}>
          <Link className={estilos.enlace} href="/fundacion">
            {t("inicio.fundacion")}
          </Link>
          <p className={estilos.detalle}>{t("inicio.fundacionDetalle")}</p>
        </li>
      </ul>
      <p className={estilos.detalle}>{t("inicio.app")}</p>
    </main>
  );
}
