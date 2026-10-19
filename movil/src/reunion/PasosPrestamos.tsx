// Pasos 5 (abonos) y 6 (préstamos) del asistente (TX6b).
// Préstamos: solicitud → votación con contadores y quórum en vivo → plan de cuotas visible
// (D21) → firmas agrupadas: "Pase el celular a…", PIN una vez por firmante, y si un PIN queda
// en pausa firma otro cargo válido en su reemplazo (D10, D13).

import { formatearPesos, ReglaInvalida } from "@credimpacto/reglas";
import { tokens } from "@credimpacto/tokens";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { FotoGrupo, MiembroFoto } from "../cola/grupo";
import type { Sesion } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { BotonPrincipal, BotonSecundario, Contador, Dinero, estilos as base, Parrafo, Titulo } from "../ui/componentes";
import { TecladoDinero } from "../ui/TecladoDinero";
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

const { color, spacing } = tokens;
const num = (n: number) => `#${String(n).padStart(2, "0")}`;
const numeroDe = (foto: FotoGrupo, titularId: string) => foto.miembros.find((m) => m.titular_id === titularId)?.numero ?? 0;

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
    return (
      <>
        <ScrollView contentContainerStyle={base.contenido}>
          <Titulo>Abono de {num(numeroDe(props.foto, editando.titular_id))}</Titulo>
          <Parrafo>
            Debe {formatearPesos(editando.saldo)}. Cuota: {formatearPesos(editando.cuota_mensual)}.
          </Parrafo>
          <View style={estilos.atajos}>
            <BotonSecundario testID="abono-cuota" texto={`Una cuota`} alTocar={() => setBorrador(editando.cuota_mensual)} />
          </View>
          <TecladoDinero testID="abono" etiqueta="Abona hoy" valor={borrador} alCambiar={setBorrador} aviso={aviso} />
          {partes ? (
            <Parrafo testID="abono-partes">
              Capital {formatearPesos(partes.capital)} · Interés {formatearPesos(partes.interes)}
            </Parrafo>
          ) : null}
        </ScrollView>
        <View style={[base.acciones, estilos.dosBotones]}>
          <View style={{ flex: 1 }}>
            <BotonSecundario texto="Cancelar" alTocar={() => setEditando(null)} />
          </View>
          <View style={{ flex: 2 }}>
            <BotonPrincipal
              testID="guardar-abono"
              texto="Guardar abono"
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
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[4]}</Titulo>
        {prestamos.length === 0 ? (
          <Parrafo testID="sin-prestamos">Nadie tiene préstamo vigente.</Parrafo>
        ) : (
          prestamos.map((p) => (
            <Pressable
              key={p.id}
              testID={`abonar-${numeroDe(props.foto, p.titular_id)}`}
              accessibilityRole="button"
              onPress={() => {
                setError(undefined);
                setBorrador(montos[p.id] ?? 0);
                setEditando(p);
              }}
              style={base.renglon}
            >
              <Text style={[base.cifraRenglon, { width: 56 }]}>{num(numeroDe(props.foto, p.titular_id))}</Text>
              <View style={{ flex: 1 }}>
                <Text style={base.parrafo}>Debe {formatearPesos(p.saldo)}</Text>
                <Text style={base.etiqueta}>{montos[p.id] ? `Abonó hoy ${formatearPesos(montos[p.id])}` : "Sin abono hoy"}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
      <View style={[base.acciones, estilos.dosBotones]}>
        <View style={{ flex: 1 }}>
          <BotonSecundario testID="paso-anterior" texto="Anterior" alTocar={props.alVolver} />
        </View>
        <View style={{ flex: 2 }}>
          <BotonPrincipal testID="seguir-prestamos" texto="Seguir a préstamos" alTocar={props.alSeguir} />
        </View>
      </View>
    </>
  );
}

// --- paso 6: préstamos ----------------------------------------------------------------------

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

  const ESTADO: Record<Solicitud["estado"], string> = {
    aprobada: "Aprobada · falta firmar",
    no_aprobada: "No aprobada",
    firmada: "Firmada · entregar el efectivo",
  };

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[5]}</Titulo>
        {lista.length === 0 ? <Parrafo testID="sin-solicitudes">Hoy nadie pidió préstamo.</Parrafo> : null}
        {lista.map((s) => (
          <View key={s.id} style={base.renglon} testID={`solicitud-${numeroDe(props.foto, s.titularId)}`}>
            <Text style={[base.cifraRenglon, { width: 56 }]}>{num(numeroDe(props.foto, s.titularId))}</Text>
            <View style={{ flex: 1 }}>
              <Text style={base.parrafo}>
                {formatearPesos(s.capital)} en {s.numCuotas} cuotas
              </Text>
              <Text style={base.etiqueta}>{ESTADO[s.estado]}</Text>
            </View>
          </View>
        ))}
        <View style={{ marginTop: spacing.md }}>
          <BotonSecundario testID="agregar-solicitud" texto="Agregar una solicitud" alTocar={() => setModo("nueva")} />
        </View>
      </ScrollView>
      <View style={[base.acciones, estilos.dosBotones]}>
        <View style={{ flex: 1 }}>
          <BotonSecundario testID="paso-anterior" texto="Anterior" alTocar={props.alVolver} />
        </View>
        <View style={{ flex: 2 }}>
          {porFirmar.length > 0 ? (
            <BotonPrincipal
              testID="firmar-aprobaciones"
              texto={`Firmar ${porFirmar.length === 1 ? "la aprobación" : `las ${porFirmar.length} aprobaciones`} de hoy`}
              alTocar={() => setModo("firmas")}
            />
          ) : (
            <BotonPrincipal testID="seguir-arqueo" texto="Seguir al arqueo" alTocar={props.alSeguir} />
          )}
        </View>
      </View>
    </>
  );
}

function NuevaSolicitud(props: PropsPaso & { yaPidieron: string[]; alTerminar: () => void }) {
  const ciclo = props.foto.ciclo!;
  const activos = props.foto.miembros.filter((m) => m.activo);
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
          {pueden.map((m) => (
            <Pressable
              key={m.titular_id}
              testID={`pide-${m.numero}`}
              accessibilityRole="button"
              onPress={() => {
                setQuien(m);
                setVoto({ aFavor: 0, enContra: 0, abstenciones: 0, presentes: cuantosVinieron });
              }}
              style={base.renglon}
            >
              <Text style={base.cifraRenglon}>{num(m.numero)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={base.acciones}>
          <BotonSecundario texto="Cancelar" alTocar={props.alTerminar} />
        </View>
      </>
    );
  }

  let plan: ReturnType<typeof planDeCuotas> | null = null;
  try {
    if (capital > 0) plan = planDeCuotas(ciclo, capital, cuotas);
  } catch {
    plan = null;
  }
  const resultado = voto ? resultadoVotacion(voto, activos.length) : null;
  const textoVoto = !resultado
    ? ""
    : !resultado.quorum
      ? `Sin quórum: deben estar más de ${Math.floor(activos.length / 2)} de ${activos.length}.`
      : !resultado.votosCuadran
        ? "Hay más votos que presentes."
        : resultado.aprobada
          ? "Aprobado por la asamblea."
          : "No aprobado.";

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>Préstamo para {num(quien.numero)}</Titulo>
        <TecladoDinero testID="capital" etiqueta="Cuánto pide" valor={capital} alCambiar={setCapital} />
        <Contador testID="cuotas" etiqueta="Cuotas (reuniones)" valor={cuotas} minimo={1} maximo={ciclo.duracion_meses} alCambiar={setCuotas} />
        {plan ? (
          <View style={estilos.plan} testID="plan-cuotas">
            <Dinero pesos={plan.cuota_mensual} etiqueta={`Paga ${cuotas} cuotas de`} />
            <Dinero pesos={plan.total_pagar} etiqueta="Total a pagar" />
          </View>
        ) : null}
        <Text style={[base.titulo, { fontSize: 22 }]}>Votación</Text>
        {voto ? (
          <>
            <Contador testID="voto-presentes" etiqueta="Presentes" valor={voto.presentes} maximo={activos.length} alCambiar={(n) => setVoto({ ...voto, presentes: n })} />
            <Contador testID="voto-favor" etiqueta="A favor" valor={voto.aFavor} maximo={voto.presentes} alCambiar={(n) => setVoto({ ...voto, aFavor: n })} />
            <Contador testID="voto-contra" etiqueta="En contra" valor={voto.enContra} maximo={voto.presentes} alCambiar={(n) => setVoto({ ...voto, enContra: n })} />
            <Contador testID="voto-abstencion" etiqueta="Abstención" valor={voto.abstenciones} maximo={voto.presentes} alCambiar={(n) => setVoto({ ...voto, abstenciones: n })} />
            <Parrafo testID="resultado-voto">{textoVoto}</Parrafo>
          </>
        ) : null}
        {error ? <Parrafo>{error}</Parrafo> : null}
      </ScrollView>
      <View style={[base.acciones, estilos.dosBotones]}>
        <View style={{ flex: 1 }}>
          <BotonSecundario texto="Cancelar" alTocar={props.alTerminar} />
        </View>
        <View style={{ flex: 2 }}>
          <BotonPrincipal
            testID="guardar-solicitud"
            texto="Guardar la votación"
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
                });
                props.alTerminar();
              } catch {
                setError("No se pudo guardar la solicitud.");
              }
            }}
          />
        </View>
      </View>
    </>
  );
}

function FirmasAgrupadas(props: PropsPaso & { solicitudes: Solicitud[]; alTerminar: () => void }) {
  const { entorno } = useSesion();
  return (
    <FirmasGrupo
      titulo="Firmar las aprobaciones"
      foto={props.foto}
      beneficiarios={props.solicitudes.map((s) => s.titularId)}
      lista={props.solicitudes.map((s) => (
        <View key={s.id} style={base.renglon}>
          <Text style={[base.cifraRenglon, { width: 56 }]}>{num(numeroDe(props.foto, s.titularId))}</Text>
          <Text style={[base.parrafo, { flex: 1 }]}>
            {formatearPesos(s.capital)} en {s.numCuotas} cuotas
          </Text>
        </View>
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
  dosBotones: { flexDirection: "row", gap: spacing.sm },
  atajos: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  plan: { gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: color.renglon },
});
