"use client";

// Ficha de una comunidad: datos, ciclo, junta, personas y acceso a la app, todo editable desde
// el panel. Los cambios quedan en la auditoría del servidor.

import { ArrowLeft, CalendarBlank, DeviceMobile, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Bloque, Cabecera, Cargando, Campo, Etiqueta, Tabla, useDatos, useEnvio, modulo as m } from "../../_panel/comunes";
import { pesosCortos, pesosExactos } from "../../_panel/formato";
import { CampoPesos, Confirmar, Pestanas, Selector } from "../../_panel/formas";
import { Personas } from "../../_panel/Personas";
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
  cargos: {
    id: string;
    tipo: string;
    texto: string;
    membresia_id: string;
    numero: number;
    nombre: string | null;
  }[];
  tipos_cargo: { tipo: string; texto: string }[];
  miembros: {
    id: string;
    numero: number;
    activo: boolean;
    nombre_corto: string | null;
    consentimiento: string;
  }[];
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

function Mensajes({ error }: { error?: string }) {
  if (error)
    return (
      <p className={m.errorFormulario} role="alert">
        {error}
      </p>
    );
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
          <span
            className={m.hojaBarra}
            style={
              {
                height: Math.max(6, (120 * r.ahorro) / max),
                "--i": i,
              } as React.CSSProperties
            }
          />
          <span className={m.hojaFecha}>
            {new Date(`${r.fecha}T12:00:00`).toLocaleDateString("es-CO", {
              month: "short",
              year: "2-digit",
            })}
          </span>
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
  const [forma, setForma] = useState({
    nombre: f.nombre,
    zona: f.zona,
    departamento: f.departamento,
    municipio: f.municipio,
  });
  return (
    <>
      <Bloque titulo="Reuniones" sub="Lo que se ahorró en cada una; los dos tonos separan los ciclos">
        <LineaDeReuniones reuniones={f.reuniones} miembros={f.miembros.filter((p) => p.activo).length} />
      </Bloque>
      <Bloque titulo="Datos de la comunidad">
        <form
          className={`${m.formulario} ${m.formularioPlano}`}
          onSubmit={async (e) => {
            e.preventDefault();
            if (await enviar(`/oficina/comunidades/${f.id}`, forma, "PUT")) {
              toast.success("Datos de la comunidad guardados.");
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
          <Mensajes error={error} />
          <div className={m.botonera}>
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
      toast.success(base ? "Ciclo actualizado" : "Ciclo abierto", {
        description: base ? "Los valores nuevos rigen desde la próxima reunión." : "Ya se puede asignar la junta del ciclo.",
      });
      setNuevo(false);
      alGuardar();
    }
  };
  return (
    <>
      <Bloque
        titulo={base ? `Ciclo ${base.numero} (activo)` : "Abrir un ciclo nuevo"}
        sub={
          base
            ? `${base.reuniones} reuniones registradas · los precios de cada reunión quedan congelados al abrirla`
            : activo
              ? `Al abrirlo se cierra el ciclo ${activo.numero}`
              : "El reglamento con el que la ACAP ahorra y presta"
        }
        acciones={
          activo && !nuevo ? (
            <button type="button" className={estilos.botonSecundario} onClick={() => setNuevo(true)}>
              Abrir ciclo nuevo
            </button>
          ) : null
        }
      >
        <form className={`${m.formulario} ${m.formularioPlano}`} onSubmit={guardar}>
          <div className={m.fila2}>
            <Campo etiqueta="Fecha de inicio">
              <input type="date" required value={forma.fecha_inicio} onChange={cambiar("fecha_inicio")} />
            </Campo>
            <Campo etiqueta="Duración (meses)">
              <input type="number" min={1} max={24} required value={forma.duracion_meses} onChange={cambiar("duracion_meses")} />
            </Campo>
          </div>
          <div className={m.fila2}>
            <CampoPesos etiqueta="Valor de la acción" requerido valor={forma.valor_accion} alCambiar={(v) => setForma({ ...forma, valor_accion: v })} />
            <Campo etiqueta="Máximo de acciones por reunión">
              <input type="number" min={1} max={50} required value={forma.max_acciones_reunion} onChange={cambiar("max_acciones_reunion")} />
            </Campo>
          </div>
          <div className={m.fila2}>
            <CampoPesos etiqueta="Fondo social por reunión" valor={forma.valor_fondo_social} alCambiar={(v) => setForma({ ...forma, valor_fondo_social: v })} />
            <CampoPesos etiqueta="Valor de la multa" valor={forma.valor_multa} alCambiar={(v) => setForma({ ...forma, valor_multa: v })} />
          </div>
          <div className={m.fila2}>
            <Campo etiqueta="Interés mensual (%)">
              <input type="number" min={0} max={20} step={0.1} required value={forma.tasa_interes} onChange={cambiar("tasa_interes")} />
            </Campo>
            <CampoPesos etiqueta="Meta de ahorro del ciclo (opcional)" valor={forma.meta_ahorro} alCambiar={(v) => setForma({ ...forma, meta_ahorro: v })} />
          </div>
          <Mensajes error={error} />
          <div className={m.botonera}>
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
              {
                clave: "numero",
                titulo: "Ciclo",
                valor: (c) => `Ciclo ${c.numero}`,
              },
              {
                clave: "inicio",
                titulo: "Inicio",
                valor: (c) => fechaCorta(c.fecha_inicio),
              },
              {
                clave: "meses",
                titulo: "Meses",
                numero: true,
                valor: (c) => c.duracion_meses,
              },
              {
                clave: "accion",
                titulo: "Acción",
                numero: true,
                valor: (c) => pesosCortos(c.valor_accion),
              },
              {
                clave: "reuniones",
                titulo: "Reuniones",
                numero: true,
                valor: (c) => c.reuniones,
              },
              {
                clave: "estado",
                titulo: "Estado",
                valor: (c) => (
                  <Etiqueta tono={c.estado === "activo" ? "bien" : "neutro"}>
                    {c.estado === "activo" ? "Activo" : c.estado === "cerrado" ? "Cerrado" : "Borrador"}
                  </Etiqueta>
                ),
              },
            ]}
          />
        </Bloque>
      ) : null}
    </>
  );
}

function Junta({ f, alGuardar }: { f: Ficha; alGuardar: () => void }) {
  const { enviar, enviando, error } = useEnvio();
  if (!f.ciclo_activo) {
    return (
      <Bloque titulo="Junta del ciclo">
        <p className={estilos.graficoVacio}>Primero abra el ciclo en la pestaña «Ciclo»: los cargos son de cada ciclo.</p>
      </Bloque>
    );
  }
  const asignar = async (tipo: string, membresia: string) => {
    if (
      await enviar(`/oficina/ciclos/${f.ciclo_activo}/cargos`, {
        tipo,
        membresia_id: membresia || null,
      })
    ) {
      toast.success("Junta actualizada", { description: "Cada cargo crea su PIN en el celular de la ACAP." });
      alGuardar();
    }
  };
  return (
    <Bloque titulo="Junta del ciclo" sub="Cada cargo firma con su propio PIN en el celular. Una persona tiene un solo cargo por ciclo.">
      <div className={`${m.formulario} ${m.formularioPlano}`}>
        {f.tipos_cargo.map((t) => {
          const actual = f.cargos.find((c) => c.tipo === t.tipo);
          return (
            <Campo key={t.tipo} etiqueta={t.texto}>
              <Selector
                valor={actual?.membresia_id ?? ""}
                deshabilitado={enviando}
                vacio="Sin asignar"
                alCambiar={(v) => void asignar(t.tipo, v)}
                opciones={f.miembros
                  .filter((p) => p.activo)
                  .map((p) => ({
                    valor: p.id,
                    texto: `#${String(p.numero).padStart(2, "0")} ${p.nombre_corto ?? "Solo número"}`,
                    detalle: p.nombre_corto ? undefined : "Sin autorización de datos",
                  }))}
              />
            </Campo>
          );
        })}
        {f.miembros.length === 0 ? <p className={m.tenue}>Todavía no hay personas. Agréguelas en la pestaña «Personas».</p> : null}
        <Mensajes error={error} />
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
  politica: {
    reparte_fondo_social: boolean;
    multas_a_repartible: boolean;
    multiplo_redondeo: number;
  };
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
                <Selector
                  compacto
                  etiqueta="Ciclo"
                  valor={cicloId}
                  alCambiar={alCambiar}
                  opciones={f.ciclos.map((x) => ({ valor: x.id, texto: `Ciclo ${x.numero}${x.estado === "activo" ? " (activo)" : ""}` }))}
                />
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
            <p className={m.titular} style={{ margin: "16px 0 0" }}>
              Política de reparto pendiente de confirmar por CoimpactoB: la ganancia se reparte según las acciones de cada miembro, el fondo social queda como
              seguro y lo entregado se redondea a billetes de {pesosExactos(c.politica.multiplo_redondeo)}.
            </p>
          </Bloque>
          {c.detalle.length ? (
            <Bloque titulo="Por miembro" sub="Lo que recibiría cada persona; si debe un préstamo, se descuenta">
              <Tabla
                filas={c.detalle}
                clave={(d) => String(d.numero_miembro)}
                vacio=""
                columnas={[
                  {
                    clave: "numero",
                    titulo: "#",
                    orden: (d) => d.numero_miembro,
                    valor: (d) => String(d.numero_miembro).padStart(2, "0"),
                  },
                  {
                    clave: "nombre",
                    titulo: "Nombre",
                    valor: (d) => d.nombre ?? <span className={m.tenue}>Solo número</span>,
                  },
                  {
                    clave: "acciones",
                    titulo: "Acciones",
                    numero: true,
                    orden: (d) => d.acciones,
                    valor: (d) => d.acciones,
                  },
                  {
                    clave: "ahorro",
                    titulo: "Ahorro",
                    numero: true,
                    orden: (d) => d.ahorro,
                    valor: (d) => pesosExactos(d.ahorro),
                  },
                  {
                    clave: "ganancia",
                    titulo: "Ganancia",
                    numero: true,
                    orden: (d) => d.participacion_interes,
                    valor: (d) => pesosExactos(d.participacion_interes),
                  },
                  {
                    clave: "deuda",
                    titulo: "Debe",
                    numero: true,
                    orden: (d) => d.deuda_pendiente,
                    valor: (d) => (d.deuda_pendiente ? pesosExactos(d.deuda_pendiente) : <span className={m.tenue}>Nada</span>),
                  },
                  {
                    clave: "entregar",
                    titulo: "A entregar",
                    numero: true,
                    orden: (d) => d.a_entregar,
                    valor: (d) => <strong>{pesosExactos(d.a_entregar)}</strong>,
                  },
                ]}
              />
            </Bloque>
          ) : null}
        </>
      )}
    </Cargando>
  );
}

function AccesoApp({ f, alGuardar }: { f: Ficha; alGuardar: () => void }) {
  const { enviar, enviando, error } = useEnvio();
  const existente = f.usuarios_app[0]?.usuario;
  const [forma, setForma] = useState({
    usuario:
      existente ??
      f.nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20),
    clave: "",
  });
  return (
    <>
      <Bloque
        titulo={existente ? "Usuario de la app" : "Crear el usuario de la app"}
        sub="Con este usuario y su clave, la junta registra el celular de la ACAP. No entra a esta oficina."
      >
        <form
          className={`${m.formulario} ${m.formularioPlano}`}
          onSubmit={async (e) => {
            e.preventDefault();
            if (await enviar(`/oficina/comunidades/${f.id}/usuario-app`, forma)) {
              toast.success(existente ? "Clave cambiada" : "Usuario creado", {
                description: existente ? "Entréguela en persona a la junta." : "Entregue el usuario y la clave en persona a la junta.",
              });
              setForma({ ...forma, clave: "" });
              alGuardar();
            }
          }}
        >
          <Campo etiqueta="Usuario" ayuda="Sin espacios. Lo escribe la junta en la app.">
            <input
              required
              value={forma.usuario}
              disabled={Boolean(existente)}
              autoComplete="off"
              onChange={(e) => setForma({ ...forma, usuario: e.target.value })}
            />
          </Campo>
          <Campo etiqueta={existente ? "Clave nueva" : "Clave"} ayuda="12 caracteres o más. Evite fechas o nombres de la comunidad.">
            <input
              required
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={forma.clave}
              onChange={(e) => setForma({ ...forma, clave: e.target.value })}
            />
          </Campo>
          <Mensajes error={error} />
          <div className={m.botonera}>
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
            {
              clave: "fecha",
              titulo: "Registrado",
              valor: (c) =>
                new Date(c.registrado_en).toLocaleString("es-CO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
            },
            {
              clave: "id",
              titulo: "Identificador",
              valor: (c) => <code className={m.tenue}>{c.id.slice(0, 8)}</code>,
            },
            {
              clave: "estado",
              titulo: "Estado",
              valor: (c) => <Etiqueta tono={c.activo ? "bien" : "neutro"}>{c.activo ? "Activo" : "Retirado"}</Etiqueta>,
            },
            {
              clave: "accion",
              titulo: "",
              valor: (c) =>
                c.activo ? (
                  <Confirmar
                    disparador={
                      <button type="button" className={estilos.botonSecundario}>
                        Retirar
                      </button>
                    }
                    titulo="¿Retirar este celular?"
                    texto="Lo que envíe después quedará por revisar. Cambie también la clave del usuario de la ACAP."
                    accion="Retirar el celular"
                    peligro
                    alConfirmar={async () => {
                      if (await enviar(`/oficina/celulares/${c.id}/retirar`, {})) {
                        toast.success("Celular retirado");
                        alGuardar();
                      }
                    }}
                  />
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
      <Cargando datos={datos} error={error} recargar={recargar}>
        {(f) => {
          const activos = f.miembros.filter((p) => p.activo).length;
          const ciclo = f.ciclos.find((c) => c.id === f.ciclo_activo);
          return (
            <>
              <Cabecera
                antes={
                  <Link href="/fundacion/comunidades" className={estilos.volver}>
                    <ArrowLeft size={14} weight="bold" aria-hidden /> Comunidades
                  </Link>
                }
                titulo={f.nombre}
                sub={[f.zona, f.municipio, f.departamento].filter(Boolean).join(" · ") || "Sin ubicación"}
                acciones={
                  <div className={estilos.datosFicha}>
                    <span>
                      <UsersThree size={16} aria-hidden /> {activos} {activos === 1 ? "miembro" : "miembros"}
                    </span>
                    <span>
                      <CalendarBlank size={16} aria-hidden /> {ciclo ? `Ciclo ${ciclo.numero} · ${ciclo.reuniones} ${ciclo.reuniones === 1 ? "reunión" : "reuniones"}` : "Sin ciclo activo"}
                    </span>
                    <span>
                      <DeviceMobile size={16} aria-hidden /> {f.celulares.filter((c) => c.activo).length ? "Celular registrado" : "Sin celular"}
                    </span>
                  </div>
                }
              />
              <Pestanas etiqueta="Secciones de la ficha" valor={pestana} alCambiar={setPestana} opciones={PESTANAS}>
                {pestana === "datos" ? <Datos f={f} alGuardar={recargar} /> : null}
                {pestana === "ciclo" ? <CicloForm key={f.ciclo_activo ?? "nuevo"} f={f} alGuardar={recargar} /> : null}
                {pestana === "junta" ? <Junta f={f} alGuardar={recargar} /> : null}
                {pestana === "personas" ? (
                  <Personas acapId={f.id} cargos={Object.fromEntries(f.cargos.map((c) => [c.membresia_id, c.texto]))} alCambiar={recargar} />
                ) : null}
                {pestana === "cierre" ? <CierreCiclo f={f} /> : null}
                {pestana === "app" ? <AccesoApp key={f.usuarios_app[0]?.usuario ?? "nuevo"} f={f} alGuardar={recargar} /> : null}
              </Pestanas>
            </>
          );
        }}
      </Cargando>
    </main>
  );
}
