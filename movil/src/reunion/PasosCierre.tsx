// Pasos 7 (arqueo), 8 (cierre y firmas) y 9 (resumen por miembro) del asistente (TX6c).
// Arqueo a ciegas por denominación con el color real de cada billete; lo esperado se revela
// al tocar "Terminé de contar" (D12). El cierre ratifica las correcciones de hoy (D9) y se
// firma en grupo; al firmar cae el sello «Bien contado» (DESIGN.md, el momento de la marca).

import { formatearPesos } from "@credimpacto/reglas";
import { tokens } from "@credimpacto/tokens";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from "react-native";

import type { Elemento } from "../cola/cola";
import type { FotoGrupo } from "../cola/grupo";
import type { Sesion } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { BotonPrincipal, BotonSecundario, Contador, Dinero, estilos as base, Parrafo, Titulo } from "../ui/componentes";
import {
  arqueoGuardado,
  BILLETES,
  cerrarReunion,
  correccionesDeHoy,
  esperadoEnCaja,
  guardarConteo,
  guardarMotivo,
  MONEDAS,
  resumenMiembro,
  terminarReunion,
  totalConteo,
  type Arqueo,
  type Conteo,
  type ResumenMiembro,
} from "./cierre";
import { FirmasGrupo } from "./FirmasGrupo";
import { PASOS, type ReunionLocal } from "./reunion";

const { color, spacing, tipo, componentes } = tokens;

interface PropsPaso {
  sesion: Sesion;
  foto: FotoGrupo;
  reunion: ReunionLocal;
  alSeguir: () => void;
  alVolver: () => void;
  alCambiar: () => void;
}

const COLOR_BILLETE: Record<number, string> = {
  100_000: color["billete-100000"],
  50_000: color["billete-50000"],
  20_000: color["billete-20000"],
  10_000: color["billete-10000"],
  5_000: color["billete-5000"],
  2_000: color["billete-2000"],
};
const NOMBRE_COLOR: Record<number, string> = {
  100_000: "verde",
  50_000: "violeta",
  20_000: "naranja",
  10_000: "rojo",
  5_000: "café",
  2_000: "azul",
};

// --- paso 7: arqueo a ciegas -----------------------------------------------------------------

export function PasoArqueo(props: PropsPaso) {
  const [fase, setFase] = useState<"billetes" | "monedas" | "revelado" | null>(null);
  const [conteo, setConteo] = useState<Conteo>({});
  const [arqueo, setArqueo] = useState<Arqueo | null>(null);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    void arqueoGuardado(props.sesion.base, props.reunion.id).then((a) => {
      setArqueo(a);
      if (a) {
        setConteo(a.conteo);
        setMotivo(a.motivo);
      }
      setFase(a ? "revelado" : "billetes");
    });
  }, [props.sesion, props.reunion.id]);

  if (!fase) return null;

  if (fase !== "revelado") {
    const denominaciones = fase === "billetes" ? BILLETES : MONEDAS;
    return (
      <>
        <ScrollView contentContainerStyle={base.contenido}>
          <Titulo>{fase === "billetes" ? "Cuenten los billetes" : "Ahora las monedas"}</Titulo>
          <Parrafo>Cuenten la caja sin mirar cuánto debería haber.</Parrafo>
          {denominaciones.map((valor) => (
            <View key={valor} style={estilos.billete}>
              <View style={[estilos.franjaBillete, { backgroundColor: COLOR_BILLETE[valor] ?? color["renglon-fuerte"] }]} />
              <View style={{ flex: 1 }}>
                <Contador
                  testID={`cuenta-${valor}`}
                  etiqueta={`${formatearPesos(valor)}${NOMBRE_COLOR[valor] ? ` · ${NOMBRE_COLOR[valor]}` : ""}`}
                  valor={conteo[valor] ?? 0}
                  maximo={999}
                  alCambiar={(n) => setConteo({ ...conteo, [valor]: n })}
                />
              </View>
            </View>
          ))}
          <View style={estilos.total}>
            <Dinero testID="arqueo-total" pesos={totalConteo(conteo)} etiqueta="Contado" grande />
          </View>
        </ScrollView>
        <View style={[base.acciones, estilos.dosBotones]}>
          <View style={{ flex: 1 }}>
            <BotonSecundario
              testID="paso-anterior"
              texto="Anterior"
              alTocar={() => (fase === "monedas" ? setFase("billetes") : props.alVolver())}
            />
          </View>
          <View style={{ flex: 2 }}>
            {fase === "billetes" ? (
              <BotonPrincipal testID="contar-monedas" texto="Contar las monedas" alTocar={() => setFase("monedas")} />
            ) : (
              <BotonPrincipal
                testID="termine-de-contar"
                texto="Terminé de contar"
                alTocar={async () => {
                  const esperado = await esperadoEnCaja(props.sesion.base, props.reunion, props.foto);
                  await guardarConteo(props.sesion.base, props.reunion.id, conteo, esperado);
                  setArqueo(await arqueoGuardado(props.sesion.base, props.reunion.id));
                  setFase("revelado");
                }}
              />
            )}
          </View>
        </View>
      </>
    );
  }

  const diferencia = arqueo!.contado - arqueo!.esperado;
  const cerrado = Boolean(arqueo!.cerradaEn);
  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[6]}</Titulo>
        <Dinero pesos={arqueo!.contado} etiqueta="Contaron" />
        <View style={{ height: spacing.md }} />
        <Dinero pesos={arqueo!.esperado} etiqueta="Debería haber" />
        <Text style={[base.titulo, { fontSize: 24 }]} testID="arqueo-resultado">
          {diferencia === 0
            ? "Cuadra al peso."
            : diferencia < 0
              ? `Faltan ${formatearPesos(-diferencia)}. Anoten el motivo.`
              : `Sobran ${formatearPesos(diferencia)}. Anoten el motivo.`}
        </Text>
        {diferencia !== 0 ? (
          <TextInput
            testID="arqueo-motivo"
            editable={!cerrado}
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Motivo"
            placeholderTextColor={color["tinta-suave"]}
            style={estilos.motivo}
            accessibilityLabel="Motivo de la diferencia"
          />
        ) : null}
        {diferencia !== 0 ? <Parrafo>La diferencia la firman dos cargos con el cierre.</Parrafo> : null}
      </ScrollView>
      <View style={[base.acciones, estilos.dosBotones]}>
        <View style={{ flex: 1 }}>
          {cerrado ? null : <BotonSecundario testID="volver-a-contar" texto="Volver a contar" alTocar={() => setFase("billetes")} />}
        </View>
        <View style={{ flex: 2 }}>
          <BotonPrincipal
            testID="seguir-cierre"
            texto="Seguir al cierre"
            falta={diferencia !== 0 && !motivo.trim() ? "Falta el motivo" : undefined}
            alTocar={async () => {
              if (diferencia !== 0 && !cerrado) await guardarMotivo(props.sesion.base, props.reunion.id, motivo);
              props.alSeguir();
            }}
          />
        </View>
      </View>
    </>
  );
}

// --- paso 8: cierre --------------------------------------------------------------------------

export function PasoCierre(props: PropsPaso) {
  const { entorno } = useSesion();
  const [arqueo, setArqueo] = useState<Arqueo | null | undefined>(undefined);
  const [correcciones, setCorrecciones] = useState<Elemento[]>([]);
  const [firmando, setFirmando] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void Promise.all([
      arqueoGuardado(props.sesion.base, props.reunion.id),
      correccionesDeHoy(props.sesion.base, props.reunion.id),
    ]).then(([a, c]) => {
      setArqueo(a);
      setCorrecciones(c);
    });
  }, [props.sesion, props.reunion.id, version]);

  if (arqueo === undefined) return null;

  if (arqueo?.cerradaEn) {
    return (
      <>
        <View style={[base.contenido, { flex: 1, alignItems: "center", justifyContent: "center" }]}>
          <Sello acap={props.foto.acap.nombre} fecha={props.reunion.fecha} />
          <Parrafo testID="reunion-cerrada">Reunión cerrada · Guardado en este celular</Parrafo>
        </View>
        <View style={base.acciones}>
          <BotonPrincipal testID="ver-resumen" texto="Ver el resumen de cada uno" alTocar={props.alSeguir} />
        </View>
      </>
    );
  }

  if (firmando && arqueo) {
    return (
      <FirmasGrupo
        titulo="Firmar el cierre"
        foto={props.foto}
        lista={<Parrafo>Caja contada: {formatearPesos(arqueo.contado)}. Con estas firmas la reunión se cierra.</Parrafo>}
        alFirmar={async (firmantes) => {
          await cerrarReunion(props.sesion.base, props.sesion.cripto, {
            reunion: props.reunion,
            firmantes,
            foto: props.foto,
            ahora: entorno.ahora(),
          });
          setFirmando(false);
          setVersion((v) => v + 1);
          props.alCambiar();
        }}
        alCancelar={() => setFirmando(false)}
      />
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[7]}</Titulo>
        {!arqueo ? (
          <Parrafo>Falta contar la caja antes de cerrar.</Parrafo>
        ) : (
          <>
            <Dinero pesos={arqueo.contado} etiqueta="Caja contada" />
            <Text style={[base.titulo, { fontSize: 22 }]}>Correcciones de hoy</Text>
            {correcciones.length === 0 ? (
              <Parrafo testID="sin-correcciones">Hoy no hubo correcciones.</Parrafo>
            ) : (
              <>
                <Parrafo>Al firmar el cierre, la junta las ratifica.</Parrafo>
                {correcciones.map((c) => (
                  <View key={c.id} style={base.renglon}>
                    <Text style={[base.parrafo, { flex: 1 }]}>{String(c.datos.motivo)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
      <View style={[base.acciones, estilos.dosBotones]}>
        <View style={{ flex: 1 }}>
          <BotonSecundario testID="paso-anterior" texto="Anterior" alTocar={props.alVolver} />
        </View>
        <View style={{ flex: 2 }}>
          <BotonPrincipal
            testID="firmar-cierre"
            texto="Firmar el cierre"
            falta={arqueo ? undefined : "Falta el arqueo"}
            alTocar={() => setFirmando(true)}
          />
        </View>
      </View>
    </>
  );
}

/** El sello «Bien contado»: cae de escala 1,25 a 1 en 320 ms, sin rebote, con una vibración de
 * 40 ms; con "Quitar animaciones" aparece quieto (DESIGN.md, Motion). */
function Sello(props: { acap: string; fecha: string }) {
  const [escala] = useState(() => new Animated.Value(1.25));
  const [opacidad] = useState(() => new Animated.Value(0));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((sinMovimiento) => {
      if (sinMovimiento) {
        escala.setValue(1);
        opacidad.setValue(1);
        return;
      }
      Vibration.vibrate(40);
      Animated.parallel([
        Animated.timing(escala, { toValue: 1, duration: 320, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }),
        Animated.timing(opacidad, { toValue: 1, duration: 320, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }),
      ]).start();
    });
  }, [escala, opacidad]);

  return (
    <Animated.View
      testID="sello"
      accessible
      accessibilityLabel="Reunión cerrada. Bien contado."
      style={[estilos.sello, { opacity: opacidad, transform: [{ scale: escala }, { rotate: "-8deg" }] }]}
    >
      <View style={estilos.selloInterior}>
        <Text style={estilos.selloTexto}>BIEN{"\n"}CONTADO</Text>
        <Text style={estilos.selloDetalle}>{props.acap}</Text>
        <Text style={estilos.selloDetalle}>{props.fecha}</Text>
      </View>
    </Animated.View>
  );
}

// --- paso 9: resumen por miembro (D27) ------------------------------------------------------

export function PasoResumen(props: PropsPaso & { alTerminar: () => void }) {
  const lista = props.foto.miembros.filter((m) => m.activo).sort((a, b) => a.numero - b.numero);
  const [indice, setIndice] = useState(0);
  const [resumen, setResumen] = useState<ResumenMiembro | null>(null);
  const miembro = lista[indice];

  useEffect(() => {
    void resumenMiembro(props.sesion.base, props.reunion, props.foto, miembro).then(setResumen);
  }, [props.sesion, props.reunion, props.foto, miembro]);

  if (!resumen) return null;
  const ultimo = indice === lista.length - 1;
  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <View style={estilos.encabezado}>
          <Text style={base.cifraClave} testID="resumen-numero" accessibilityRole="header">
            #{String(miembro.numero).padStart(2, "0")}
          </Text>
          <Text style={base.cifraRenglon}>
            {indice + 1}/{lista.length}
          </Text>
        </View>
        <View style={estilos.cifras}>
          <Dinero testID="resumen-hoy" pesos={resumen.ahorroHoy} etiqueta="Ahorró hoy" grande />
          <Dinero pesos={resumen.ahorroCiclo} etiqueta="Total ahorrado en el ciclo" />
          {resumen.debePrestamo !== null ? <Dinero pesos={resumen.debePrestamo} etiqueta="Debe del préstamo" /> : null}
        </View>
        <Text style={base.etiqueta}>Pendiente de confirmar por la Fundación.</Text>
      </ScrollView>
      <View style={[base.acciones, estilos.dosBotones]}>
        <View style={{ flex: 1 }}>
          {indice > 0 ? <BotonSecundario texto="Anterior" alTocar={() => setIndice(indice - 1)} /> : null}
        </View>
        <View style={{ flex: 2 }}>
          {ultimo ? (
            <BotonPrincipal
              testID="terminar-reunion"
              texto="Terminar la reunión"
              alTocar={async () => {
                await terminarReunion(props.sesion.base, props.reunion.id);
                props.alTerminar();
              }}
            />
          ) : (
            <BotonPrincipal testID="resumen-siguiente" texto="Siguiente" alTocar={() => setIndice(indice + 1)} />
          )}
        </View>
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  dosBotones: { flexDirection: "row", gap: spacing.sm },
  billete: { flexDirection: "row", alignItems: "stretch", gap: spacing.sm },
  franjaBillete: { width: 14, marginVertical: spacing.sm, borderRadius: componentes.billete.rounded },
  total: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 3, borderTopColor: color.tinta },
  motivo: {
    ...tipo.body,
    color: color.tinta,
    borderWidth: 2,
    borderColor: componentes.dinero.borderColor,
    borderRadius: componentes.dinero.rounded,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  encabezado: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: spacing.lg },
  cifras: { gap: spacing.lg, marginVertical: spacing.lg },
  sello: {
    width: 200,
    height: 200,
    borderRadius: componentes.sello.rounded,
    borderWidth: 3,
    borderColor: componentes.sello.borderColor,
    padding: 6,
    marginBottom: spacing.lg,
  },
  selloInterior: {
    flex: 1,
    borderRadius: componentes.sello.rounded,
    borderWidth: 1.5,
    borderColor: componentes.sello.borderColor,
    alignItems: "center",
    justifyContent: "center",
  },
  selloTexto: { ...tipo["campo-titulo"], color: componentes.sello.textColor, textAlign: "center", lineHeight: 30 },
  selloDetalle: { ...tipo.label, color: componentes.sello.textColor, textAlign: "center" },
});
