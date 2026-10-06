import Link from "next/link";
import { t } from "@/i18n";
import estilos from "./inicio.module.css";

export default function Inicio() {
  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("inicio.titulo")}</h1>
      <ul className={estilos.opciones}>
        <li className={estilos.opcion}>
          <Link className={estilos.enlace} href="/reunion">
            {t("inicio.reunion")}
          </Link>
          <p className={estilos.detalle}>{t("inicio.reunionDetalle")}</p>
        </li>
        <li className={estilos.opcion}>
          <Link className={estilos.enlace} href="/fundacion">
            {t("inicio.fundacion")}
          </Link>
          <p className={estilos.detalle}>{t("inicio.fundacionDetalle")}</p>
        </li>
      </ul>
    </main>
  );
}
