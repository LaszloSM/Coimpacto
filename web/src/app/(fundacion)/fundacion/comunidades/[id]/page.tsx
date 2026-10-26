"use client";

// Ficha de una comunidad: datos, ciclo, junta, personas y acceso a la app, todo editable desde
// el panel. Los cambios quedan en la auditoría del servidor.

import { ArrowLeft } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Bloque, Cargando, Campo, Etiqueta, Tabla, useDatos, useEnvio, modulo as m } from "../../_panel/comunes";
import { pesosCortos, pesosExactos } from "../../_panel/formato";
import { fechaCorta } from "../../_panel/prestamos";
import estilos from "../../_panel/tablero.module.css";

interface Ciclo {
  id: string;
  numero: number;
  estado: string;
  fecha_inicio: string;
  duracion_meses: number;
  valor_accion: number;
  max_acciones_reunion: number;
  valor_fondo_social: number;
  valor_multa: number;
  tasa_interes: number;
  meta_ahorro: number | null;
  reuniones: number;
}

interface ReunionLinea {
  id: string;
  fecha: string;
  ciclo: number;
  numero: number;
  ahorro: number;
  fondo_social: number;
  multas: number;
  ahorraron: number;
}

interface Ficha {
  reuniones: ReunionLinea[];
  id: string;
  nombre: string;
  zona: string;
  departamento: string;
  municipio: string;
  ciclos: Ciclo[];
  ciclo_activo: string | null;
  cargos: { id: string; tipo: string; texto: string; membresia_id: string; numero: number; nombre: string | null }[];
  tipos_cargo: { tipo: string; texto: string }[];
  miembros: { id: string; numero: number; activo: boolean; nombre_corto: string | null; consentimiento: string }[];
  usuarios_app: { usuario: string; activo: boolean; creado: string }[];
  celulares: { id: string; registrado_en: string; activo: boolean }[];
}

const PESTANAS = [
  ["datos", "Datos"],
  ["ciclo", "Ciclo"],
  ["junta", "Junta"],
  ["personas", "Personas"],
  ["cierre", "Cierre del ciclo"],
  ["app", "Acceso a la app"],
] as const;
type Pestana = (typeof PESTANAS)[number][0];

function Mensajes({ error, exito }: { error?: string; exito?: string }) {
  if (error) return <p className={m.errorFormulario} role="alert">{error}</p>;
  if (exito) return <p className={m.exito} role="status">{exito}</p>;
  return null;
}

/** Las últimas reuniones como hojas del cuaderno: la altura es lo que se ahorró. */
function LineaDeReuniones({ reuniones, miembros }: { reuniones: ReunionLinea[]; miembros: number }) {
  if (!reuniones.length) return <p className={estilos.graficoVacio}>Todavía no hay reuniones registradas.</p>;
  const max = Math.max(...reuniones.map((r) => r.ahorro), 1);
  return (
    <ol className={m.linea}>
      {reuniones.map((r, i) => (
        <li
          key={r.id}
          className={m.hoja}
          data-ciclo-par={r.ciclo % 2 === 0}
          title={`Ciclo ${r.ciclo}, reunión ${r.numero}: ahorro ${pesosExactos(r.ahorro)}, fondo social ${pesosExactos(r.fondo_social)}, multas ${pesosExactos(r.multas)}`}
        >
          <span className={m.hojaMonto}>{pesosCortos(r.ahorro)}</span>
          <span className={m.hojaBarra} style={{ height: Math.max(6, (120 * r.ahorro) / max), "--i": i } as React.CSSProperties} />
          <span className={m.hojaFecha}>{new Date(`${r.fecha}T12:00:00`).toLocaleDateString("es-CO", { month: "short", year: "2-digit" })}</span>
          <span>
            {r.ahorraron}
            {miembros ? ` de ${miembros}` : ""} ahorraron
          </span>
        </li>
      ))}
    </ol>
  );
}

function Datos({ f, alGuardar }: { f: Ficha; alGuardar: () => void }) {
  const { enviar, enviando, error } = useEnvio();
  const [exito, setExito] = useState<string>();
  const [forma, setForma] = useState({ nombre: f.nombre, zona: f.zona, departamento: f.departamento, municipio: f.municipio });
  return (
    <>
    <Bloque titulo="Reuniones" sub="Lo que se ahorró en cada una; los dos tonos separan los ciclos">
      <LineaDeReuniones reuniones={f.reuniones} miembros={f.miembros.filter((p) => p.activo).length} />
    </Bloque>
    <Bloque titulo="Datos de la comunidad">
      <form
        className={m.formulario}
        style={{ maxWidth: 560 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setExito(undefined);
          if (await enviar(`/oficina/comunidades/${f.id}`, forma, "PUT")) {
            setExito("Datos guardados.");
            alGuardar();
          }
        }}
      >
        <Campo etiqueta="Nombre">
          <input required value={forma.nombre} onChange={(e) => setForma({ ...forma, nombre: e.target.value })} />
        </Campo>
        <Campo etiqueta="Zona">
          <input value={forma.zona} onChange={(e) => setForma({ ...forma, zona: e.target.value })} />
        </Campo>
        <div className={m.fila2}>
          <Campo etiqueta="Departamento">
            <input value={forma.departamento} onChange={(e) => setForma({ ...forma, departamento: e.target.value })} />
          </Campo>
          <Campo etiqueta="Municipio">
            <input value={forma.municipio} onChange={(e) => setForma({ ...forma, municipio: e.target.value })} />
          </Campo>
        </div>
        <Mensajes error={error} exito={exito} />
        <div className={m.botonera} style={{ justifyContent: "flex-start" }}>
          <button type="submit" className={estilos.botonPrincipal} disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Bloque>
    </>
  );
}

function CicloForm({ f, alGuardar }: { f: Ficha; alGuardar: () => void }) {
  const activo = f.ciclos.find((c) => c.id === f.ciclo_activo);
  const { enviar, enviando, error } = useEnvio();
  const [exito, setExito] = useState<string>();
  const [nuevo, setNuevo] = useState(!activo);
  const base = activo && !nuevo ? activo : null;
  const [forma, setForma] = useState({
    fecha_inicio: base?.fecha_inicio ?? new Date().toISOString().slice(0, 10),
    duracion_meses: String(base?.duracion_meses ?? 12),
    valor_accion: String(base?.valor_accion ?? 10000),
    max_acciones_reunion: String(base?.max_acciones_reunion ?? 5),
    valor_fondo_social: String(base?.valor_fondo_social ?? 2000),
    valor_multa: String(base?.valor_multa ?? 2000),
    tasa_interes: String(base?.tasa_interes ?? 3),
    meta_ahorro: base?.meta_ahorro ? String(base.meta_ahorro) : "",
  });
  const cambiar = (campo: keyof typeof forma) => (e: React.ChangeEvent<HTMLInputElement>) => setForma({ ...forma, [campo]: e.target.value });
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setExito(undefined);
    const cuerpo = {
      fecha_inicio: forma.fecha_inicio,
      duracion_meses: Number(forma.duracion_meses),
      valor_accion: Number(forma.valor_accion),
      max_acciones_reunion: Number(forma.max_acciones_reunion),
      valor_fondo_social: Number(forma.valor_fondo_social),
      valor_multa: Number(forma.valor_multa),
      tasa_interes: forma.tasa_interes,
      meta_ahorro: forma.meta_ahorro ? Number(forma.meta_ahorro) : null,
      estado: "activo",
    };
    const ok = base ? await enviar(`/oficina/ciclos/${base.id}`, cuerpo, "PUT") : await enviar(`/oficina/comunidades/${f.id}/ciclos`, cuerpo);
    if (ok) {
      setExito(base ? "Ciclo actualizado. Los valores nuevos rigen desde la próxima reunión." : "Ciclo abierto.");
      setNuevo(false);
      alGuardar();
    }
  };
  return (
    <>
      <Bloque
        titulo={base ? `Ciclo ${base.numero} (activo)` : "Abrir un ciclo nuevo"}
        sub={base ? `${base.reuniones} reuniones registradas · los precios de cada reunión quedan congelados al abrirla` : activo ? `Al abrirlo se cierra el ciclo ${activo.numero}` : "El reglamento con el que la ACAP ahorra y presta"}
        acciones={
          activo && !nuevo ? (
            <button type="button" className={estilos.botonSecundario} onClick={() => setNuevo(true)}>
              Abrir ciclo nuevo
            </button>
          ) : null
        }
      >
        <form className={m.formulario} style={{ maxWidth: 640 }} onSubmit={guardar}>
          <div className={m.fila2}>
            <Campo etiqueta="Fecha de inicio">
              <input type="date" required value={forma.fecha_inicio} onChange={cambiar("fecha_inicio")} />
            </Campo>
            <Campo etiqueta="Duración (meses)">
              <input type="number" min={1} max={24} required value={forma.duracion_meses} onChange={cambiar("duracion_meses")} />
            </Campo>
          </div>
          <div className={m.fila2}>
            <Campo etiqueta="Valor de la acción" ayuda={pesosExactos(Number(forma.valor_accion) || 0)}>
              <input type="number" min={100} step={100} required value={forma.valor_accion} onChange={cambiar("valor_accion")} />
            </Campo>
            <Campo etiqueta="Máximo de acciones por reunión">
              <input type="number" min={1} max={50} required value={forma.max_acciones_reunion} onChange={cambiar("max_acciones_reunion")} />
            </Campo>
          </div>
          <div className={m.fila2}>
            <Campo etiqueta="Fondo social por reunión" ayuda={pesosExactos(Number(forma.valor_fondo_social) || 0)}>
              <input type="number" min={0} step={100} value={forma.valor_fondo_social} onChange={cambiar("valor_fondo_social")} />
            </Campo>
            <Campo etiqueta="Valor de la multa" ayuda={pesosExactos(Number(forma.valor_multa) || 0)}>
              <input type="number" min={0} step={100} value={forma.valor_multa} onChange={cambiar("valor_multa")} />
            </Campo>
          </div>
          <div className={m.fila2}>
            <Campo etiqueta="Interés mensual (%)">
              <input type="number" min={0} max={20} step={0.1} required value={forma.tasa_interes} onChange={cambiar("tasa_interes")} />
            </Campo>
            <Campo etiqueta="Meta de ahorro del ciclo (opcional)">
              <input type="number" min={0} step={1000} value={forma.meta_ahorro} onChange={cambiar("meta_ahorro")} />
            </Campo>
          </div>
          <Mensajes error={error} exito={exito} />
          <div className={m.botonera} style={{ justifyContent: "flex-start" }}>
            {nuevo && activo ? (
              <button type="button" className={estilos.botonSecundario} onClick={() => setNuevo(false)}>
                Cancelar
              </button>
            ) : null}
            <button type="submit" className={estilos.botonPrincipal} disabled={enviando}>
              {enviando ? "Guardando…" : base ? "Guardar cambios" : "Abrir el ciclo"}
            </button>
          </div>
        </form>
      </Bloque>
      {f.ciclos.length > 0 ? (
        <Bloque titulo="Historial de ciclos">
          <Tabla
            filas={f.ciclos}
            clave={(c) => c.id}
            vacio=""
            columnas={[
              { clave: "numero", titulo: "Ciclo", valor: (c) => `Ciclo ${c.numero}` },
              { clave: "inicio", titulo: "Inicio", valor: (c) => fechaCorta(c.fecha_inicio) },
              { clave: "meses", titulo: "Meses", numero: true, valor: (c) => c.duracion_meses },
              { clave: "accion", titulo: "Acción", numero: true, valor: (c) => pesosCortos(c.valor_accion) },
              { clave: "reuniones", titulo: "Reuniones", numero: true, valor: (c) => c.reuniones },
              { clave: "estado", titulo: "Estado", valor: (c) => <Etiqueta tono={c.estado === "activo" ? "bien" : "neutro"}>{c.estado === "activo" ? "Activo" : c.estado === "cerrado" ? "Cerrado" : "Borrador"}</Etiqueta> },
            ]}
          />
        </Bloque>
      ) : null}
    </>
  );
}

function Junta({ f, alGuardar }: { f: Ficha; alGuardar: () => void }) {
  const { enviar, enviando, error } = useEnvio();
  const [exito, setExito] = useState<string>();
  if (!f.ciclo_activo) {
    return (
      <Bloque titulo="Junta del ciclo">
        <p className={estilos.graficoVacio}>Primero abra el ciclo en la pestaña «Ciclo»: los cargos son de cada ciclo.</p>
      </Bloque>
    );
  }
  const asignar = async (tipo: string, membresia: string) => {
    setExito(undefined);
    if (await enviar(`/oficina/ciclos/${f.ciclo_activo}/cargos`, { tipo, membresia_id: membresia || null })) {
      setExito("Junta actualizada. Cada cargo crea su PIN en el celular de la ACAP.");
      alGuardar();
    }
  };
  return (
    <Bloque titulo="Junta del ciclo" sub="Cada cargo firma con su propio PIN en el celular. Una persona tiene un solo cargo por ciclo.">
      <div className={m.formulario} style={{ maxWidth: 560 }}>
        {f.tipos_cargo.map((t) => {
          const actual = f.cargos.find((c) => c.tipo === t.tipo);
          return (
            <Campo key={t.tipo} etiqueta={t.texto}>
              <select value={actual?.membresia_id ?? ""} disabled={enviando} onChange={(e) => void asignar(t.tipo, e.target.value)}>
                <option value="">Sin asignar</option>
                {f.miembros
                  .filter((p) => p.activo)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      #{String(p.numero).padStart(2, "0")} {p.nombre_corto ?? "(sin consentimiento de datos)"}
                    </option>
                  ))}
              </select>
            </Campo>
          );
        })}
        {f.miembros.length === 0 ? <p className={m.tenue}>Todavía no hay personas. Agréguelas en la pestaña «Personas».</p> : null}
        <Mensajes error={error} exito={exito} />
      </div>
    </Bloque>
  );
}

interface Cierre {
  ciclo: number;
  estado: string;
  termina: string;
  dias_para_terminar: number;
  reuniones: number;
  politica: { reparte_fondo_social: boolean; multas_a_repartible: boolean; multiplo_redondeo: number };
  totales: {
    acciones: number;
    ahorro: number;
    fondo_social: number;
    multas: number;
    interes_prestamos: number;
    ganancia: number;
    monto_repartible: number;
    residuo_redondeo: number;
  } | null;
  detalle: {
    numero_miembro: number;
    nombre: string | null;
    acciones: number;
    ahorro: number;
    participacion_interes: number;
    deuda_pendiente: number;
    a_entregar: number;
    deuda_arrastrada: number;
  }[];
}

function CierreCiclo({ f }: { f: Ficha }) {
  const [cicloId, setCicloId] = useState(f.ciclo_activo ?? f.ciclos[0]?.id ?? "");
  if (!cicloId) {
    return (
      <Bloque titulo="Cierre del ciclo">
        <p className={estilos.graficoVacio}>Esta comunidad todavía no tiene ciclos.</p>
      </Bloque>
    );
  }
  return <CierreDe key={cicloId} f={f} cicloId={cicloId} alCambiar={setCicloId} />;
}

function CierreDe({ f, cicloId, alCambiar }: { f: Ficha; cicloId: string; alCambiar: (id: string) => void }) {
  const { datos, error, recargar } = useDatos<Cierre>(`/oficina/ciclos/${cicloId}/cierre`);
  return (
    <Cargando datos={datos} error={error} recargar={recargar}>
      {(c) => (
        <>
          <Bloque
            titulo={`Reparto del ciclo ${c.ciclo}`}
            sub={
              c.estado === "activo"
                ? c.dias_para_terminar > 0
                  ? `Vista previa: termina el ${fechaCorta(c.termina)}, en ${c.dias_para_terminar} días. El cierre lo firman la junta y la asamblea en la reunión final, en la app.`
                  : "Vista previa: el ciclo ya cumplió su duración. El cierre lo firman la junta y la asamblea en la reunión final, en la app."
                : "Así quedaría el reparto con lo registrado en el libro."
            }
            acciones={
              f.ciclos.length > 1 ? (
                <select className={m.campo} value={cicloId} onChange={(e) => alCambiar(e.target.value)} aria-label="Ciclo" style={{ minHeight: 40, padding: "0 10px", borderRadius: 8, border: "1px solid var(--borde-fuerte)", font: "inherit" }}>
                  {f.ciclos.map((x) => (
                    <option key={x.id} value={x.id}>
                      Ciclo {x.numero}
                      {x.estado === "activo" ? " (activo)" : ""}
                    </option>
                  ))}
                </select>
              ) : null
            }
          >
            {c.totales ? (
              <dl className={m.ficha}>
                <div>
                  <dt>Ahorro (acciones)</dt>
                  <dd>{pesosExactos(c.totales.ahorro)}</dd>
                </div>
                <div>
                  <dt>Intereses cobrados</dt>
                  <dd>{pesosExactos(c.totales.interes_prestamos)}</dd>
                </div>
                <div>
                  <dt>Multas (ganancia del grupo)</dt>
                  <dd>{pesosExactos(c.totales.multas)}</dd>
                </div>
                <div>
                  <dt>Ganancia a repartir</dt>
                  <dd>{pesosExactos(c.totales.ganancia)}</dd>
                </div>
                <div>
                  <dt>Total a repartir</dt>
                  <dd>{pesosExactos(c.totales.monto_repartible)}</dd>
                </div>
                <div>
                  <dt>Fondo social (no se reparte)</dt>
                  <dd>{pesosExactos(c.totales.fondo_social)}</dd>
                </div>
              </dl>
            ) : (
              <p className={estilos.graficoVacio}>Todavía no hay ahorro registrado en este ciclo.</p>
            )}
            <p className={m.tenue} style={{ margin: "16px 0 0" }}>
              Política de reparto pendiente de confirmar por CoimpactoB: la ganancia se reparte según las acciones de cada miembro, el fondo social queda como seguro y lo entregado se redondea a billetes de {pesosExactos(c.politica.multiplo_redondeo)}.
            </p>
          </Bloque>
          {c.detalle.length ? (
            <Bloque titulo="Por miembro" sub="Lo que recibiría cada persona; si debe un préstamo, se descuenta">
              <Tabla
                filas={c.detalle}
                clave={(d) => String(d.numero_miembro)}
                vacio=""
                columnas={[
                  { clave: "numero", titulo: "#", orden: (d) => d.numero_miembro, valor: (d) => String(d.numero_miembro).padStart(2, "0") },
                  { clave: "nombre", titulo: "Nombre", valor: (d) => d.nombre ?? <span className={m.tenue}>Solo número</span> },
                  { clave: "acciones", titulo: "Acciones", numero: true, orden: (d) => d.acciones, valor: (d) => d.acciones },
                  { clave: "ahorro", titulo: "Ahorro", numero: true, orden: (d) => d.ahorro, valor: (d) => pesosExactos(d.ahorro) },
                  { clave: "ganancia", titulo: "Ganancia", numero: true, orden: (d) => d.participacion_interes, valor: (d) => pesosExactos(d.participacion_interes) },
                  { clave: "deuda", titulo: "Debe", numero: true, orden: (d) => d.deuda_pendiente, valor: (d) => (d.deuda_pendiente ? pesosExactos(d.deuda_pendiente) : "—") },
                  { clave: "entregar", titulo: "A entregar", numero: true, orden: (d) => d.a_entregar, valor: (d) => <strong>{pesosExactos(d.a_entregar)}</strong> },
                ]}
              />
            </Bloque>
          ) : null}
        </>
      )}
    </Cargando>
  );
}

function Personas({ f }: { f: Ficha }) {
  return (
    <Bloque
      titulo={`Personas (${f.miembros.length})`}
      sub="El nombre se ve solo con el consentimiento de datos vigente (Ley 1581)"
      acciones={
        <Link className={estilos.botonPrincipal} href={`/fundacion/miembros?acap=${f.id}`}>
          Agregar o editar personas
        </Link>
      }
    >
      <Tabla
        filas={f.miembros}
        clave={(p) => p.id}
        vacio="Todavía no hay personas en esta comunidad."
        columnas={[
          { clave: "numero", titulo: "#", orden: (p) => p.numero, valor: (p) => String(p.numero).padStart(2, "0") },
          { clave: "nombre", titulo: "Nombre", valor: (p) => p.nombre_corto ?? <span className={m.tenue}>Solo número</span> },
          { clave: "cargo", titulo: "Cargo", valor: (p) => f.cargos.find((c) => c.membresia_id === p.id)?.texto ?? <span className={m.tenue}>Miembro</span> },
          {
            clave: "consentimiento",
            titulo: "Datos personales",
            valor: (p) => <Etiqueta tono={p.consentimiento === "vigente" ? "bien" : "atencion"}>{p.consentimiento === "vigente" ? "Autorizó" : p.consentimiento === "revocado" ? "Revocó" : "Falta autorización"}</Etiqueta>,
          },
          { clave: "activo", titulo: "Estado", valor: (p) => (p.activo ? "Activo" : <span className={m.tenue}>Retirado</span>) },
        ]}
      />
    </Bloque>
  );
}

function AccesoApp({ f, alGuardar }: { f: Ficha; alGuardar: () => void }) {
  const { enviar, enviando, error } = useEnvio();
  const [exito, setExito] = useState<string>();
  const existente = f.usuarios_app[0]?.usuario;
  const [forma, setForma] = useState({ usuario: existente ?? f.nombre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").slice(0, 20), clave: "" });
  return (
    <>
      <Bloque
        titulo={existente ? "Usuario de la app" : "Crear el usuario de la app"}
        sub="Con este usuario y su clave, la junta registra el celular de la ACAP. No entra a esta oficina."
      >
        <form
          className={m.formulario}
          style={{ maxWidth: 560 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setExito(undefined);
            if (await enviar(`/oficina/comunidades/${f.id}/usuario-app`, forma)) {
              setExito(existente ? "Clave cambiada. Entréguela en persona a la junta." : "Usuario creado. Entregue el usuario y la clave en persona a la junta.");
              setForma({ ...forma, clave: "" });
              alGuardar();
            }
          }}
        >
          <Campo etiqueta="Usuario" ayuda="Sin espacios. Lo escribe la junta en la app.">
            <input required value={forma.usuario} disabled={Boolean(existente)} autoComplete="off" onChange={(e) => setForma({ ...forma, usuario: e.target.value })} />
          </Campo>
          <Campo etiqueta={existente ? "Clave nueva" : "Clave"} ayuda="12 caracteres o más. Evite fechas o nombres de la comunidad.">
            <input required type="password" minLength={12} autoComplete="new-password" value={forma.clave} onChange={(e) => setForma({ ...forma, clave: e.target.value })} />
          </Campo>
          <Mensajes error={error} exito={exito} />
          <div className={m.botonera} style={{ justifyContent: "flex-start" }}>
            <button type="submit" className={estilos.botonPrincipal} disabled={enviando}>
              {enviando ? "Guardando…" : existente ? "Cambiar la clave" : "Crear usuario"}
            </button>
          </div>
        </form>
      </Bloque>
      <Bloque titulo="Celulares registrados" sub="Si se pierde un celular, retírelo y cambie la clave">
        <Tabla
          filas={f.celulares}
          clave={(c) => c.id}
          vacio="Todavía no se ha registrado ningún celular."
          columnas={[
            { clave: "fecha", titulo: "Registrado", valor: (c) => new Date(c.registrado_en).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) },
            { clave: "id", titulo: "Identificador", valor: (c) => <span className={m.tenue}>{c.id.slice(0, 8)}</span> },
            { clave: "estado", titulo: "Estado", valor: (c) => <Etiqueta tono={c.activo ? "bien" : "neutro"}>{c.activo ? "Activo" : "Retirado"}</Etiqueta> },
            {
              clave: "accion",
              titulo: "",
              valor: (c) =>
                c.activo ? (
                  <button
                    type="button"
                    className={estilos.botonSecundario}
                    onClick={async () => {
                      if (window.confirm("¿Retirar este celular? Lo que envíe después quedará por revisar.")) {
                        if (await enviar(`/oficina/celulares/${c.id}/retirar`, {})) alGuardar();
                      }
                    }}
                  >
                    Retirar
                  </button>
                ) : null,
            },
          ]}
        />
      </Bloque>
    </>
  );
}

export default function FichaComunidad() {
  const { id } = useParams<{ id: string }>();
  const { datos, error, recargar } = useDatos<Ficha>(`/oficina/comunidades/${id}`);
  const [pestana, setPestana] = useState<Pestana>("datos");
  return (
    <main className={estilos.pagina}>
      <Link href="/fundacion/comunidades" className={m.tenue} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12, textDecoration: "none" }}>
        <ArrowLeft size={14} aria-hidden /> Comunidades
      </Link>
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(f) => (
          <>
            <header className={estilos.cabeza}>
              <div>
                <h1 className={estilos.titulo}>{f.nombre}</h1>
                <p className={estilos.subtitulo}>
                  {[f.zona, f.municipio, f.departamento].filter(Boolean).join(" · ") || "Sin ubicación"} · {f.miembros.filter((p) => p.activo).length} miembros
                </p>
              </div>
            </header>
            <div className={m.pestanas} role="tablist">
              {PESTANAS.map(([clave, texto]) => (
                <button key={clave} type="button" role="tab" aria-selected={pestana === clave} className={m.pestana} onClick={() => setPestana(clave)}>
                  {texto}
                  {pestana === clave ? <motion.span layoutId="marca-pestana" className={m.pestanaMarca} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} /> : null}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {pestana === "datos" ? <Datos f={f} alGuardar={recargar} /> : null}
              {pestana === "ciclo" ? <CicloForm key={f.ciclo_activo ?? "nuevo"} f={f} alGuardar={recargar} /> : null}
              {pestana === "junta" ? <Junta f={f} alGuardar={recargar} /> : null}
              {pestana === "personas" ? <Personas f={f} /> : null}
              {pestana === "cierre" ? <CierreCiclo f={f} /> : null}
              {pestana === "app" ? <AccesoApp key={f.usuarios_app[0]?.usuario ?? "nuevo"} f={f} alGuardar={recargar} /> : null}
            </div>
          </>
        )}
      </Cargando>
    </main>
  );
}
