"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { t } from "@/i18n";
import { api } from "@/lib/api";

import estilos from "../oficina.module.css";

export default function Entrar() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState(false);
  const [entrando, setEntrando] = useState(false);

  return (
    <main className={estilos.pagina}>
      <h1 className={estilos.titulo}>{t("entrar.titulo")}</h1>
      <form
        className={estilos.formulario}
        onSubmit={async (e) => {
          e.preventDefault();
          setEntrando(true);
          setError(false);
          try {
            await api("/sesion/entrar", { metodo: "POST", cuerpo: { usuario, clave } });
            router.replace("/fundacion/celulares");
          } catch {
            setError(true);
            setEntrando(false);
          }
        }}
      >
        <label className={estilos.etiqueta}>
          {t("entrar.usuario")}
          <input
            className={estilos.campo}
            name="usuario"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
        </label>
        <label className={estilos.etiqueta}>
          {t("entrar.clave")}
          <input
            className={estilos.campo}
            name="clave"
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
          />
        </label>
        {error ? (
          <p className={estilos.error} role="alert">
            {t("entrar.error")}
          </p>
        ) : null}
        <button className={estilos.principal} type="submit" disabled={entrando}>
          {entrando ? t("entrar.entrando") : t("entrar.boton")}
        </button>
      </form>
    </main>
  );
}
