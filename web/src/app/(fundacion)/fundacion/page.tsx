"use client";

// Panel de gerencia: cifras del ciclo, pulso de cada comunidad, hallazgos y crecimiento.
// Todo viene de /api/oficina/tablero; un bloque sin datos dice qué falta, nunca inventa.

import { ArrowDownRight, ArrowUpRight, CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, SinSesion } from "@/lib/api";

import { Chispa } from "./_panel/comunes";
import { fechaLarga, pesosCortos, pesosExactos, porcentaje } from "./_panel/formato";
import { Crecimiento, Nuevos, Top } from "./_panel/Graficos";
import { Zonas } from "./_panel/Zonas";
import { Pulso } from "./_panel/Pulso";
import estilos from "./_panel/tablero.module.css";
import type { Hallazgo, Tablero } from "./_panel/tipos";

function Variacion({ valor, texto }: { valor: number | null; texto: string }) {
  if (valor === null) return <span className={estilos.variacionNeutra}>{texto}</span>;
  const sube = valor >= 0;
  const Flecha = sube ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={sube ? estilos.variacionSube : estilos.variacionBaja}>
      <Flecha size={14} weight="bold" aria-hidden />
      {porcentaje(Math.abs(valor))} <span className={estilos.variacionTexto}>{texto}</span>
    </span>
  );
}

function Cifra(props: { etiqueta: string; valor: string; exacto?: string; pie: React.ReactNode; i: number; destacada?: boolean; serie?: number[] }) {
  return (
    <div className={props.destacada ? `${estilos.cifra} ${estilos.cifraDestacada}` : estilos.cifra} style={{ "--i": props.i } as React.CSSProperties}>
      <dt className={estilos.cifraEtiqueta}>
        {props.destacada ? <span className={estilos.marcaAhorro} aria-hidden /> : null}
        {props.etiqueta}
      </dt>
      <dd className={estilos.cifraValor} title={props.exacto}>
        {props.valor}
        {props.exacto ? <span className={estilos.oculto}> ({props.exacto})</span> : null}
      </dd>
      <dd className={estilos.cifraPie}>{props.pie}</dd>
      {props.serie ? (
        <dd style={{ margin: "10px 0 0" }}>
          <Chispa serie={props.serie} color={props.destacada ? "var(--naranja)" : "var(--azul)"} />
        </dd>
      ) : null}
    </div>
  );
}

const ICONO_HALLAZGO = { alerta: WarningCircle, bien: CheckCircle, neutro: Info } as const;

function Hallazgos({ hallazgos }: { hallazgos: Hallazgo[] }) {
  return (
    <section className={estilos.hallazgos} aria-labelledby="titulo-hallazgos">
      <h2 id="titulo-hallazgos" className={estilos.bloqueTitulo}>
        Para mirar hoy
      </h2>
      {hallazgos.length === 0 ? (
        <p className={estilos.hallazgosVacio}>Nada fuera de lo normal en las comunidades con datos.</p>
      ) : (
        <ul className={estilos.hallazgosLista}>
          {hallazgos.map((h) => {
            const Icono = ICONO_HALLAZGO[h.tono];
            return (
              <li key={h.texto} className={estilos.hallazgo} data-tono={h.tono}>
                <Icono size={20} weight="fill" aria-hidden />
                <p>
                  {h.texto}
                  {h.acap_id ? (
                    <>
                      {" "}
                      <Link href={`/fundacion/comunidades/${h.acap_id}`}>Ver comunidad</Link>
                    </>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Esqueleto() {
  return (
    <div className={estilos.esqueleto} aria-busy="true" aria-label="Cargando el panel">
      <div className={estilos.esqueletoFila}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={estilos.esqueletoCifra} />
        ))}
      </div>
      <span className={estilos.esqueletoBloque} />
      <div className={estilos.esqueletoFila}>
        <span className={estilos.esqueletoGrafico} />
        <span className={estilos.esqueletoGrafico} />
      </div>
    </div>
  );
}

export default function Panel() {
  const router = useRouter();
  const [datos, setDatos] = useState<Tablero | null>(null);
  const [error, setError] = useState<string>();

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<Tablero>("/oficina/tablero")
      .then((d) => {
        if (vigente) setDatos(d);
      })
      .catch((e) => {
        if (!vigente) return;
        if (e instanceof SinSesion) router.replace("/fundacion/entrar");
        else setError("No se pudo cargar el panel. Revise la conexión e intente de nuevo.");
      });
    return () => {
      vigente = false;
    };
  }, [router, intento]);

  const reintentar = () => {
    setError(undefined);
    setIntento((n) => n + 1);
  };

  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabeza}>
        <div>
          <h1 className={estilos.titulo}>Panel de gerencia</h1>
          <p className={estilos.subtitulo}>
            {datos?.datos_al ? `Datos al ${fechaLarga(datos.datos_al)}` : "Ciclo actual de todas las comunidades"}
          </p>
        </div>
      </header>

      {error ? (
        <div className={estilos.error} role="alert">
          <p>{error}</p>
          <button type="button" className={estilos.botonSecundario} onClick={reintentar}>
            Intentar de nuevo
          </button>
        </div>
      ) : !datos ? (
        <Esqueleto />
      ) : datos.resumen.comunidades === 0 ? (
        <section className={estilos.vacioGrande}>
          <h2>Todavía no hay comunidades</h2>
          <p>Cree la primera ACAP con su ciclo activo y su junta. El panel se llena a medida que las juntas sincronizan sus reuniones.</p>
          <Link className={estilos.botonPrincipal} href="/fundacion/comunidades">
            Crear la primera ACAP
          </Link>
        </section>
      ) : (
        <>
          <dl className={estilos.cifras}>
            <Cifra
              i={0}
              destacada
              etiqueta="Ahorro del ciclo"
              valor={pesosCortos(datos.resumen.ahorro)}
              exacto={pesosExactos(datos.resumen.ahorro)}
              pie={<Variacion valor={datos.resumen.ahorro_variacion} texto="vs. mes pasado" />}
              serie={datos.series.mensual.map((m) => m.ahorro)}
            />
            <Cifra
              i={1}
              etiqueta="Cartera activa"
              valor={pesosCortos(datos.resumen.cartera)}
              exacto={pesosExactos(datos.resumen.cartera)}
              pie={<span className={estilos.variacionNeutra}>{pesosCortos(datos.indicadores.cartera_vencida)} vencida</span>}
              serie={datos.series.mensual.map((m) => m.credito)}
            />
            <Cifra
              i={2}
              etiqueta="Comunidades activas"
              valor={`${datos.resumen.comunidades_activas} de ${datos.resumen.comunidades}`}
              pie={<span className={estilos.variacionNeutra}>con ciclo abierto</span>}
            />
            <Cifra
              i={3}
              etiqueta="Miembros"
              valor={datos.resumen.miembros.toLocaleString("es-CO")}
              pie={<Variacion valor={datos.resumen.miembros_variacion} texto="vs. mes pasado" />}
            />
          </dl>

          <dl className={estilos.indicadores}>
            <div>
              <dt>Cumplimiento de pagos</dt>
              <dd data-tono={datos.indicadores.cumplimiento !== null && datos.indicadores.cumplimiento < 90 ? "alerta" : "bien"}>
                {porcentaje(datos.indicadores.cumplimiento)}
              </dd>
            </div>
            <div>
              <dt>Índice de mora</dt>
              <dd data-tono={datos.indicadores.mora > 10 ? "alerta" : datos.indicadores.mora > 0 ? "atencion" : "bien"}>
                {porcentaje(datos.indicadores.mora)}
              </dd>
            </div>
            <div>
              <dt>Capacitaciones</dt>
              <dd data-tono="vacio">
                {datos.indicadores.capacitaciones ?? "Módulo en preparación"}
              </dd>
            </div>
            <div>
              <dt>Proyectos activos</dt>
              <dd data-tono="vacio">
                {datos.indicadores.proyectos ?? "Módulo en preparación"}
              </dd>
            </div>
          </dl>

          <Hallazgos hallazgos={datos.hallazgos} />
          <Pulso comunidades={datos.pulso} />

          <div className={estilos.graficos}>
            <Crecimiento serie={datos.series.mensual} />
            <Zonas zonas={datos.series.zonas} />
            <Top top={datos.series.top} />
            <Nuevos serie={datos.series.nuevos} />
          </div>
        </>
      )}
    </main>
  );
}
