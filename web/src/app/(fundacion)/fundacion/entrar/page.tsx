"use client";

// Entrar a la oficina: a la izquierda la marca sobre el renglón del cuaderno, a la derecha la
// ficha con usuario y clave. Si la clave no sirve lo dice sin culpar a nadie.

import { ArrowRight, Eye, EyeSlash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { t } from "@/i18n";
import { api } from "@/lib/api";

import { Campo } from "../_panel/formas";
import e from "../_panel/entrar.module.css";
import f from "../_panel/formas.module.css";
import estilos from "../_panel/tablero.module.css";

export default function Entrar() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState(false);
  const [entrando, setEntrando] = useState(false);

  return (
    <main className={e.pagina}>
      <section className={e.marca} aria-hidden>
        <p className={e.logo}>
          Cred<span>i</span>mpacto
        </p>
        <div className={e.frase}>
          <p>El libro de las comunidades que ahorran juntas.</p>
          <p className={e.fraseSub}>Panel de la Fundación CoimpactoB</p>
        </div>
      </section>
      <section className={e.lado}>
        <form
          className={e.ficha}
          onSubmit={async (evento) => {
            evento.preventDefault();
            setEntrando(true);
            setError(false);
            try {
              await api("/sesion/entrar", { metodo: "POST", cuerpo: { usuario, clave } });
              router.replace("/fundacion");
            } catch {
              setError(true);
              setEntrando(false);
            }
          }}
        >
          <h1 className={e.titulo}>{t("entrar.titulo")}</h1>
          <p className={e.subtitulo}>Con el usuario que le dio el administrador de la Fundación.</p>
          <Campo etiqueta={t("entrar.usuario")}>
            <input name="usuario" autoComplete="username" autoCapitalize="none" value={usuario} onChange={(x) => setUsuario(x.target.value)} required />
          </Campo>
          <div className={f.campo}>
            <label className={f.etiqueta} htmlFor="clave">
              {t("entrar.clave")}
            </label>
            <span className={e.clave}>
              <input id="clave" className={f.entrada} name="clave" type={ver ? "text" : "password"} autoComplete="current-password" value={clave} onChange={(x) => setClave(x.target.value)} required />
              <button type="button" className={e.ver} onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar la clave" : "Mostrar la clave"}>
                {ver ? <EyeSlash size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </span>
          </div>
          {error ? (
            <p className={e.error} role="alert">
              {t("entrar.error")}
            </p>
          ) : null}
          <button className={`${estilos.botonPrincipal} ${e.boton}`} type="submit" disabled={entrando}>
            {entrando ? t("entrar.entrando") : t("entrar.boton")}
            {entrando ? null : <ArrowRight size={16} weight="bold" aria-hidden />}
          </button>
        </form>
      </section>
    </main>
  );
}
