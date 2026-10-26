// Pasos 5 (abonos) y 6 (préstamos) del asistente (TX6b).
// Préstamos: solicitud → votación con contadores y quórum en vivo → plan de cuotas visible
// (D21) → firmas agrupadas: "Pase el celular a…", PIN una vez por firmante, y si un PIN queda
// en pausa firma otro cargo válido en su reemplazo (D10, D13).

import { formatearPesos, ReglaInvalida } from "@credimpacto/reglas";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { FotoGrupo, MiembroFoto } from "../cola/grupo";
import type { Sesion } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import {
  Acciones,
  BotonPrincipal,
  BotonSecundario,
  BotonVolver,
  Contador,
  Dinero,
  estilos as base,
  Etiqueta,
  Nota,
  Parrafo,
  Renglon,
  Rotulo,
  Titulo,
} from "../ui/componentes";
import { Ir, Mas } from "../ui/iconos";
import { TecladoDinero } from "../ui/TecladoDinero";
import { c } from "../ui/tema";
import { FirmasGrupo } from "./FirmasGrupo";
import {
  abonoRegistrado,
  firmarPrestamos,
  guardarSolicitud,
  partesAbono,
  planDeCuotas,
  registrarAbono,
  resultadoVotacion,
  solicitudes as leerSolicitudes,
  type PrestamoFoto,
  type Solicitud,
  type Votacion,
} from "./prestamos";
import { asistencia as leerAsistencia, PASOS, type ReunionLocal } from "./reunion";

const num = (n: number) => `#${String(n).padStart(2, "0")}`;
const dos = (n: number) => String(n).padStart(2, "0");
const miembroDe = (foto: FotoGrupo, titularId: string) => foto.miembros.find((m) => m.titular_id === titularId);
const numeroDe = (foto: FotoGrupo, titularId: string) => miembroDe(foto, titularId)?.numero ?? 0;

interface PropsPaso {
  sesion: Sesion;
  foto: FotoGrupo;
  reunion: ReunionLocal;
  alSeguir: () => void;
  alVolver: () => void;
  alCambiar: () => void;
}

// --- paso 5: abonos -------------------------------------------------------------------------

export function PasoAbonos(props: PropsPaso) {
  const { entorno } = useSesion();
  const prestamos = props.foto.prestamos;
  const [montos, setMontos] = useState<Record<string, number> | null>(null);
  const [editando, setEditando] = useState<PrestamoFoto | null>(null);
  const [borrador, setBorrador] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void Promise.all(prestamos.map((p) => abonoRegistrado(props.sesion.base, props.reunion.id, p.id))).then((lista) =>
      setMontos(Object.fromEntries(prestamos.map((p, i) => [p.id, lista[i]]))),
    );
  }, [props.sesion, props.reunion.id, prestamos]);

  if (!montos) return null;

  if (editando) {
    let partes: { capital: number; interes: number } | null = null;
    let aviso = error;
    try {
      if (borrador > 0) partes = partesAbono(editando, borrador);
    } catch (e) {
      if (e instanceof ReglaInvalida) aviso = `Es más que lo que debe (${formatearPesos(editando.saldo)}).`;
    }
    const quien = miembroDe(props.foto, editando.titular_id);
    return (
      <>
        <ScrollView contentContainerStyle={base.contenido} keyboardShouldPersistTaps="handled">
          <Titulo>Abono de {num(numeroDe(props.foto, editando.titular_id))}</Titulo>
          {quien?.nombre_corto ? <Parrafo tenue>{quien.nombre_corto}</Parrafo> : null}
          <View style={estilos.ficha}>
            <View style={estilos.fichaDato}>
              <Text style={base.etiqueta}>Debe</Text>
              <Text style={base.cifraRenglon}>{formatearPesos(editando.saldo)}</Text>
            </View>
            <View style={estilos.fichaDato}>
              <Text style={base.etiqueta}>Cuota</Text>
              <Text style={base.cifraRenglon}>{formatearPesos(editando.cuota_mensual)}</Text>
            </View>
          </View>
          <BotonSecundario testID="abono-cuota" texto="Abona una cuota" detalle={formatearPesos(editando.cuota_mensual)} alTocar={() => setBorrador(editando.cuota_mensual)} />
          <TecladoDinero testID="abono" etiqueta="Abona hoy" valor={borrador} alCambiar={setBorrador} aviso={aviso} />
          {partes ? (
            <View style={estilos.partes} testID="abono-partes" accessible accessibilityLabel={`Capital ${formatearPesos(partes.capital)}, interés ${formatearPesos(partes.interes)}`}>
              <View style={estilos.parte}>
                <Text style={base.etiqueta}>Capital</Text>
                <Text style={base.cifraRenglonPequena}>{formatearPesos(partes.capital)}</Text>
              </View>
              <View style={estilos.parte}>
                <Text style={base.etiqueta}>Interés</Text>
                <Text style={base.cifraRenglonPequena}>{formatearPesos(partes.interes)}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
        <Acciones fila>
          <BotonVolver texto="Cancelar" alTocar={() => setEditando(null)} />
          <BotonPrincipal
            testID="guardar-abono"
            texto="Guardar abono"
            sinFlecha
            falta={borrador > 0 && !partes ? "Revise el monto" : undefined}
            alTocar={async () => {
              try {
                await registrarAbono(props.sesion.base, props.sesion.cripto, {
                  reunion: props.reunion,
                  prestamo: editando,
                  monto: borrador,
                  firmante: props.sesion.firmante,
                  ahora: entorno.ahora(),
                });
                setMontos({ ...montos, [editando.id]: borrador });
                setEditando(null);
                props.alCambiar();
              } catch {
                setError("No se pudo guardar el abono. Revise el monto.");
              }
            }}
          />
        </Acciones>
      </>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[4]}</Titulo>
        {prestamos.length === 0 ? (
          <Nota testID="sin-prestamos">Nadie tiene préstamo vigente.</Nota>
        ) : (
          <>
            <Parrafo tenue>Toque a quien abona hoy.</Parrafo>
            <View style={{ marginTop: 12 }}>
              {prestamos.map((p) => {
                const n = numeroDe(props.foto, p.titular_id);
                const abono = montos[p.id];
                return (
                  <Renglon
                    key={p.id}
                    numero={dos(n)}
                    testID={`abonar-${n}`}
                    accesible={`Abono de ${num(n)}. Debe ${formatearPesos(p.saldo)}`}
                    alTocar={() => {
                      setError(undefined);
                      setBorrador(montos[p.id] ?? 0);
                      setEditando(p);
                    }}
                    derecha={abono ? <Etiqueta tono="bien">Abonó {formatearPesos(abono)}</Etiqueta> : <Ir size={20} color={c.tenue} weight="bold" />}
                  >
                    <Text style={base.parrafo}>Debe {formatearPesos(p.saldo)}</Text>
                    <Text style={base.detalleRenglon}>{abono ? "Abono anotado" : `Cuota de ${formatearPesos(p.cuota_mensual)}`}</Text>
                  </Renglon>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
      <Acciones fila>
        <BotonVolver testID="paso-anterior" alTocar={props.alVolver} />
        <BotonPrincipal testID="seguir-prestamos" texto="Seguir a préstamos" alTocar={props.alSeguir} />
      </Acciones>
    </>
  );
}

// --- paso 6: préstamos ----------------------------------------------------------------------

const ESTADO: Record<Solicitud["estado"], { texto: string; tono: "bien" | "aviso" | "mal" }> = {
  aprobada: { texto: "Aprobada · falta firmar", tono: "aviso" },
  no_aprobada: { texto: "No aprobada", tono: "mal" },
  firmada: { texto: "Firmada · entregar el efectivo", tono: "bien" },
};

export function PasoPrestamos(props: PropsPaso) {
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [modo, setModo] = useState<"lista" | "nueva" | "firmas">("lista");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void leerSolicitudes(props.sesion.base, props.reunion.id).then(setLista);
  }, [props.sesion, props.reunion.id, version]);

  if (!lista) return null;
  const recargar = () => {
    setVersion((v) => v + 1);
    props.alCambiar();
  };
  const porFirmar = lista.filter((s) => s.estado === "aprobada");

  if (modo === "nueva") {
    return (
      <NuevaSolicitud
        {...props}
        yaPidieron={lista.map((s) => s.titularId)}
        alTerminar={() => {
          setModo("lista");
          recargar();
        }}
      />
    );
  }
  if (modo === "firmas") {
    return (
      <FirmasAgrupadas
        {...props}
        solicitudes={porFirmar}
        alTerminar={() => {
          setModo("lista");
          recargar();
        }}
      />
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[5]}</Titulo>
        {lista.length === 0 ? (
          <Parrafo tenue testID="sin-solicitudes">
            Hoy nadie pidió préstamo.
          </Parrafo>
        ) : (
          <View style={{ marginTop: 8 }}>
            {lista.map((s) => (
              <Renglon key={s.id} numero={dos(numeroDe(props.foto, s.titularId))} testID={`solicitud-${numeroDe(props.foto, s.titularId)}`}>
                <Text style={base.parrafo}>
                  {formatearPesos(s.capital)} en {s.numCuotas} cuotas
                </Text>
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Etiqueta tono={ESTADO[s.estado].tono}>{ESTADO[s.estado].texto}</Etiqueta>
                </View>
              </Renglon>
            ))}
          </View>
        )}
        <View style={{ marginTop: 18 }}>
          <BotonSecundario testID="agregar-solicitud" texto="Agregar una solicitud" icono={<Mas size={20} color={c.tinta} weight="bold" />} alTocar={() => setModo("nueva")} />
        </View>
      </ScrollView>
      <Acciones fila>
        <BotonVolver testID="paso-anterior" alTocar={props.alVolver} />
        {porFirmar.length > 0 ? (
          <BotonPrincipal
            testID="firmar-aprobaciones"
            texto={`Firmar ${porFirmar.length === 1 ? "la aprobación" : `las ${porFirmar.length} aprobaciones`}`}
            alTocar={() => setModo("firmas")}
          />
        ) : (
          <BotonPrincipal testID="seguir-arqueo" texto="Seguir al arqueo" alTocar={props.alSeguir} />
        )}
      </Acciones>
    </>
  );
}

function NuevaSolicitud(props: PropsPaso & { yaPidieron: string[]; alTerminar: () => void }) {
  const ciclo = props.foto.ciclo!;
  const activos = props.foto.miembros.filter((m) => m.activo).sort((a, b) => a.numero - b.numero);
  const conPrestamo = new Set(props.foto.prestamos.filter((p) => p.saldo > 0).map((p) => p.titular_id));
  const [presentes, setPresentes] = useState<Map<string, boolean> | null>(null);
  const [quien, setQuien] = useState<MiembroFoto | null>(null);
  const [capital, setCapital] = useState(0);
  const [cuotas, setCuotas] = useState(4);
  const [voto, setVoto] = useState<Votacion | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void leerAsistencia(props.sesion.base, props.reunion.id).then(setPresentes);
  }, [props.sesion, props.reunion.id]);
  if (!presentes) return null;
  const cuantosVinieron = activos.filter((m) => presentes.get(m.membresia_id) ?? true).length;

  if (!quien) {
    const pueden = activos.filter((m) => !conPrestamo.has(m.titular_id) && !props.yaPidieron.includes(m.titular_id));
    return (
      <>
        <ScrollView contentContainerStyle={base.contenido}>
          <Titulo>¿Quién pide préstamo?</Titulo>
          <Parrafo tenue>No aparecen quienes ya deben un préstamo ni quienes ya pidieron hoy.</Parrafo>
          <View style={{ marginTop: 12 }}>
            {pueden.map((m) => (
              <Renglon
                key={m.titular_id}
                numero={dos(m.numero)}
                testID={`pide-${m.numero}`}
                accesible={`Pide ${num(m.numero)}`}
                alTocar={() => {
                  setQuien(m);
                  setVoto({ aFavor: 0, enContra: 0, abstenciones: 0, presentes: cuantosVinieron });
                }}
                derecha={<Ir size={20} color={c.tenue} weight="bold" />}
              >
                <Text style={base.parrafo}>{m.nombre_corto ?? `Miembro ${num(m.numero)}`}</Text>
              </Renglon>
            ))}
          </View>
        </ScrollView>
        <Acciones>
          <BotonSecundario texto="Cancelar" alTocar={props.alTerminar} />
        </Acciones>
      </>
    );
  }

  let plan: ReturnType<typeof planDeCuotas> | null = null;
  try {
    if (capital > 0) plan = planDeCuotas(ciclo, capital, cuotas);
  } catch {
    plan = null;
  }
  const resultado = voto ? resultadoVotacion(voto, activos.length, props.foto.acap) : null;
  // Mínimo de presentes con el reglamento de la ACAP (ET2): más que el porcentaje de activos.
  const minimo = Math.floor(((props.foto.acap.quorum_porcentaje ?? 50) * activos.length) / 100) + 1;
  const textoVoto = !resultado
    ? ""
    : !resultado.quorum
      ? `Sin quórum: deben estar al menos ${minimo} de ${activos.length}.`
      : !resultado.votosCuadran
        ? "Hay más votos que presentes."
        : resultado.aprobada
          ? "Aprobado por la asamblea."
          : "No aprobado.";
  const tonoVoto = !resultado ? "neutro" : resultado.aprobada && resultado.quorum && resultado.votosCuadran ? "bien" : resultado.quorum && resultado.votosCuadran ? "mal" : "aviso";

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>Préstamo para {num(quien.numero)}</Titulo>
        {quien.nombre_corto ? <Parrafo tenue>{quien.nombre_corto}</Parrafo> : null}
        <TecladoDinero testID="capital" etiqueta="Cuánto pide" valor={capital} alCambiar={setCapital} />
        <Contador testID="cuotas" etiqueta="Cuotas" detalle="Una por reunión" valor={cuotas} minimo={1} maximo={ciclo.duracion_meses} alCambiar={setCuotas} />
        {plan ? (
          <View style={estilos.plan} testID="plan-cuotas">
            <Dinero pesos={plan.cuota_mensual} etiqueta={`Paga ${cuotas} cuotas de`} />
            <View style={estilos.planLinea} />
            <Dinero pesos={plan.total_pagar} etiqueta="Total a pagar" />
          </View>
        ) : null}
        <Rotulo>Votación de la asamblea</Rotulo>
        {voto ? (
          <>
            <Contador testID="voto-presentes" etiqueta="Presentes" valor={voto.presentes} maximo={activos.length} alCambiar={(n) => setVoto({ ...voto, presentes: n })} />
            <Contador testID="voto-favor" etiqueta="A favor" valor={voto.aFavor} maximo={voto.presentes} alCambiar={(n) => setVoto({ ...voto, aFavor: n })} />
            <Contador testID="voto-contra" etiqueta="En contra" valor={voto.enContra} maximo={voto.presentes} alCambiar={(n) => setVoto({ ...voto, enContra: n })} />
            <Contador testID="voto-abstencion" etiqueta="Abstención" valor={voto.abstenciones} maximo={voto.presentes} alCambiar={(n) => setVoto({ ...voto, abstenciones: n })} />
            <View style={{ marginTop: 14 }}>
              <Nota tono={tonoVoto} testID="resultado-voto">
                {textoVoto}
              </Nota>
            </View>
          </>
        ) : null}
        {error ? (
          <View style={{ marginTop: 12 }}>
            <Nota tono="mal">{error}</Nota>
          </View>
        ) : null}
      </ScrollView>
      <Acciones fila>
        <BotonVolver texto="Cancelar" alTocar={props.alTerminar} />
        <BotonPrincipal
          testID="guardar-solicitud"
          texto="Guardar la votación"
          sinFlecha
          falta={!plan ? "Falta cuánto pide" : resultado && !resultado.votosCuadran ? "Revise los votos" : undefined}
          alTocar={async () => {
            try {
              await guardarSolicitud(props.sesion.base, props.sesion.cripto, {
                reunion: props.reunion,
                titularId: quien.titular_id,
                capital,
                numCuotas: cuotas,
                votacion: voto!,
                activos: activos.length,
                ciclo,
                prestamosVigentes: props.foto.prestamos,
                politica: props.foto.acap,
              });
              props.alTerminar();
            } catch {
              setError("No se pudo guardar la solicitud.");
            }
          }}
        />
      </Acciones>
    </>
  );
}

function FirmasAgrupadas(props: PropsPaso & { solicitudes: Solicitud[]; alTerminar: () => void }) {
  const { entorno } = useSesion();
  return (
    <FirmasGrupo
      titulo="Firmar las aprobaciones"
      permiso="firma_prestamos"
      foto={props.foto}
      beneficiarios={props.solicitudes.map((s) => s.titularId)}
      lista={props.solicitudes.map((s) => (
        <Renglon key={s.id} numero={dos(numeroDe(props.foto, s.titularId))}>
          <Text style={base.parrafo}>
            {formatearPesos(s.capital)} en {s.numCuotas} cuotas
          </Text>
        </Renglon>
      ))}
      alFirmar={async (firmantes) => {
        await firmarPrestamos(props.sesion.base, props.sesion.cripto, {
          reunion: props.reunion,
          firmantes,
          foto: props.foto,
          ahora: entorno.ahora(),
        });
        props.alTerminar();
      }}
      alCancelar={props.alTerminar}
    />
  );
}

const estilos = StyleSheet.create({
  ficha: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: c.mesa,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.renglonFuerte,
  },
  fichaDato: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  partes: { flexDirection: "row", gap: 10, marginTop: 4 },
  parte: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: c.mesa, gap: 2 },
  plan: {
    marginTop: 12,
    padding: 16,
    gap: 12,
    borderRadius: 16,
    backgroundColor: c.naranjaTinte,
    borderWidth: 1,
    borderColor: "rgba(246, 106, 3, 0.25)",
  },
  planLinea: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(246, 106, 3, 0.35)" },
});
