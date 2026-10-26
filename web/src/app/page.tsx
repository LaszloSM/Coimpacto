import { ArrowRight, DeviceMobile } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { t } from "@/i18n";

import estilos from "./inicio.module.css";

// La web es la plataforma de la Fundación; la reunión de la junta vive en la app Android.
export default function Inicio() {
  return (
    <main className={estilos.pagina}>
      <p className={estilos.marca}>
        Cred<span>i</span>mpacto
      </p>
      <section className={estilos.centro}>
        <h1 className={estilos.titulo}>{t("inicio.titulo")}</h1>
        <p className={estilos.texto}>{t("app.descripcion")}</p>
        <Link className={estilos.entrar} href="/fundacion">
          {t("inicio.fundacion")}
          <ArrowRight size={18} weight="bold" aria-hidden />
        </Link>
        <p className={estilos.detalle}>{t("inicio.fundacionDetalle")}</p>
      </section>
      <p className={estilos.app}>
        <DeviceMobile size={20} weight="duotone" aria-hidden />
        {t("inicio.app")}
      </p>
    </main>
  );
}
