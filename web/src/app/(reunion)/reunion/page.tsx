"use client";

// Superficie de reunión: 100 % de cliente y offline-first (DT2 construye el asistente).
import { t } from "@/i18n";
import estilos from "../../inicio.module.css";

export default function Reunion() {
  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("reunion.titulo")}</h1>
      <p className={estilos.detalle}>{t("reunion.enConstruccion")}</p>
    </main>
  );
}
