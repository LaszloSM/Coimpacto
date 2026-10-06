// Oficina de la Fundación (S6 construye las 5 secciones).
import { t } from "@/i18n";
import estilos from "../../inicio.module.css";

export default function Fundacion() {
  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("fundacion.titulo")}</h1>
      <p className={estilos.detalle}>{t("fundacion.enConstruccion")}</p>
    </main>
  );
}
