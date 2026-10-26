// Paso 2 "Cambios desde la última reunión" (D7, ET3): una propuesta a la vez, con lo que se
// registró, lo que propone la Fundación y el motivo para leer en voz alta. "Aceptar" pasa a las
// firmas de la junta (D10); "No aceptar" pide un motivo de la lista y una nota (D3 = A).

import { formatearPesos } from "@credimpacto/reglas";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { FotoGrupo, PropuestaFoto } from "../cola/grupo";
import type { Sesion } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { Acciones, BotonPrincipal, BotonSecundario, estilos as base, Parrafo, Pulsable, Rotulo, Titulo } from "../ui/componentes";
import { Chulo, Megafono } from "../ui/iconos";
import { c, t } from "../ui/tema";
import { FirmasGrupo } from "./FirmasGrupo";
import { aceptar, MOTIVOS_NO_ACEPTAR, noAceptar, nombreDelRegistro, porResponder, type MotivoNoAceptar } from "./propuestas";
import { PASOS } from "./reunion";

const fecha = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long" });

function quien(foto: FotoGrupo, titularId: string | null) {
  const m = foto.miembros.find((x) => x.titular_id === titularId);
  if (!m) return "";
  return [`#${String(m.numero).padStart(2, "0")}`, m.nombre_corto].filter(Boolean).join(" ");
}

/** El texto para leer en voz alta (D7): qué se anotó, qué se propone y por qué. */
export function textoEnVozAlta(foto: FotoGrupo, p: PropuestaFoto): string {
  const m = p.movimiento;
  const de = quien(foto, m.titular_id);
  const registro = `${nombreDelRegistro(m.tipo)} de ${formatearPesos(Math.abs(m.monto))}${de ? ` de ${de}` : ""}, reunión ${m.reunion} del ${fecha(m.fecha)}`;
  const propone = p.accion === "anular" ? "quitarlo del cuaderno" : "dejarlo como está";
  return `${registro}. La Fundación propone ${propone} porque: ${p.motivo}`;
}

export function PasoCambios(props: { sesion: Sesion; foto: FotoGrupo; alTerminar: () => void }) {
  const { entorno } = useSesion();
  const [lista, setLista] = useState<PropuestaFoto[] | null>(null);
  const [modo, setModo] = useState<"ver" | "firmar" | "no_aceptar">("ver");
  const [motivo, setMotivo] = useState<MotivoNoAceptar | null>(null);
  const [nota, setNota] = useState("");
  const [version, setVersion] = useState(0);
  // El asistente pasa una función nueva en cada render: la última se guarda aparte para no
  // volver a leer la lista cada vez.
  const alTerminar = useRef(props.alTerminar);
  useEffect(() => {
    alTerminar.current = props.alTerminar;
  });

  useEffect(() => {
    let vigente = true;
    void porResponder(props.sesion.base, props.foto).then((pendientes) => {
      if (!vigente) return;
      if (pendientes.length === 0) alTerminar.current();
      else setLista(pendientes);
    });
    return () => {
      vigente = false;
    };
  }, [props.sesion, props.foto, version]);

  if (!lista || lista.length === 0) return null;
  const actual = lista[0];
  const siguiente = () => {
    setModo("ver");
    setMotivo(null);
    setNota("");
    setVersion((v) => v + 1);
  };

  if (modo === "firmar") {
    return (
      <FirmasGrupo
        titulo="Firmar el cambio"
        foto={props.foto}
        lista={<Parrafo>{textoEnVozAlta(props.foto, actual)}</Parrafo>}
        alFirmar={async (firmantes) => {
          await aceptar(props.sesion.base, props.sesion.cripto, { propuesta: actual, firmantes, foto: props.foto, ahora: entorno.ahora() });
          siguiente();
        }}
        alCancelar={() => setModo("ver")}
      />
    );
  }

  if (modo === "no_aceptar") {
    return (
      <>
        <ScrollView contentContainerStyle={base.contenido} keyboardShouldPersistTaps="handled">
          <Titulo>¿Por qué no lo aceptan?</Titulo>
          <View style={{ marginTop: 6 }}>
            {MOTIVOS_NO_ACEPTAR.map((m) => {
              const elegido = motivo === m.id;
              return (
                <Pulsable
                  key={m.id}
                  testID={`motivo-${m.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegido }}
                  onPress={() => setMotivo(m.id)}
                  vibra="paso"
                  escala={0.985}
                  style={[estilos.opcion, elegido && estilos.opcionElegida]}
                >
                  <View style={[estilos.radio, elegido && estilos.radioElegido]}>{elegido ? <Chulo size={16} color={c.papel} weight="bold" /> : null}</View>
                  <Text style={estilos.opcionTexto}>{m.texto}</Text>
                </Pulsable>
              );
            })}
          </View>
          <Rotulo>Nota (opcional)</Rotulo>
          <TextInput
            testID="nota-no-aceptar"
            style={estilos.nota}
            value={nota}
            onChangeText={setNota}
            maxLength={300}
            multiline
            placeholder="Lo que la junta quiere que sepa la Fundación"
            placeholderTextColor={c.tenue}
            accessibilityLabel="Nota"
          />
        </ScrollView>
        <Acciones>
          <BotonPrincipal
            testID="guardar-no-aceptar"
            texto="Guardar"
            sinFlecha
            falta={motivo ? undefined : "Elija un motivo"}
            alTocar={async () => {
              if (!motivo) return;
              await noAceptar(props.sesion.base, props.sesion.cripto, {
                propuesta: actual,
                motivo,
                nota,
                firmante: props.sesion.firmante,
                ahora: entorno.ahora(),
              });
              siguiente();
            }}
          />
          <BotonSecundario testID="volver-cambio" texto="Volver" alTocar={() => setModo("ver")} />
        </Acciones>
      </>
    );
  }

  const registro = `${nombreDelRegistro(actual.movimiento.tipo)} · ${formatearPesos(Math.abs(actual.movimiento.monto))}${
    quien(props.foto, actual.movimiento.titular_id) ? ` · ${quien(props.foto, actual.movimiento.titular_id)}` : ""
  } · reunión ${actual.movimiento.reunion}`;
  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[1]}</Titulo>
        <Text style={estilos.cuenta}>{lista.length === 1 ? "1 cambio por revisar" : `${lista.length} cambios por revisar`}</Text>
        <View style={estilos.tarjeta}>
          <Text style={estilos.etiqueta}>Lo que se anotó</Text>
          <Text style={[estilos.registro, actual.accion === "anular" && estilos.tachado]} testID="cambio-registro">
            {registro}
          </Text>
          <View style={estilos.linea} />
          <Text style={estilos.etiqueta}>Lo que propone la Fundación</Text>
          <Text style={estilos.propuesta} testID="cambio-propuesta">
            {actual.accion === "anular" ? "Quitarlo del cuaderno" : "Dejarlo como está"}
          </Text>
        </View>
        <View style={estilos.vozAlta}>
          <View style={estilos.vozAltaCabeza}>
            <Megafono size={20} color={c.naranja} weight="duotone" />
            <Text style={estilos.vozAltaTitulo}>Para leer en voz alta</Text>
          </View>
          <Parrafo testID="cambio-voz-alta">{textoEnVozAlta(props.foto, actual)}</Parrafo>
        </View>
      </ScrollView>
      <Acciones>
        <BotonPrincipal testID="aceptar-cambio" texto="Aceptar y firmar" alTocar={() => setModo("firmar")} />
        <BotonSecundario testID="no-aceptar-cambio" texto="No aceptar" alTocar={() => setModo("no_aceptar")} />
      </Acciones>
    </>
  );
}

const estilos = StyleSheet.create({
  cuenta: { ...t.label, fontSize: 16, color: c.suave, marginBottom: 14 },
  tarjeta: { padding: 16, borderRadius: 18, backgroundColor: c.mesa, gap: 6 },
  etiqueta: { ...t.label, fontSize: 14, color: c.suave },
  registro: { ...t["body-fuerte"], color: c.tinta },
  tachado: { textDecorationLine: "line-through", textDecorationColor: c.mal },
  propuesta: { ...t["campo-subtitulo"], color: c.tinta },
  linea: { height: StyleSheet.hairlineWidth, backgroundColor: c.renglonFuerte, marginVertical: 8 },
  vozAlta: { marginTop: 14, padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(246, 106, 3, 0.35)", gap: 8 },
  vozAltaCabeza: { flexDirection: "row", alignItems: "center", gap: 8 },
  vozAltaTitulo: { ...t.label, fontSize: 15, color: c.naranjaTexto },
  opcion: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: c.hueco,
  },
  opcionElegida: { backgroundColor: c.naranjaTinte },
  opcionTexto: { ...t.body, color: c.tinta, flex: 1 },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: c.renglonFuerte,
    backgroundColor: c.papel,
    alignItems: "center",
    justifyContent: "center",
  },
  radioElegido: { borderColor: c.tinta, backgroundColor: c.tinta },
  nota: { ...t.body, color: c.tinta, minHeight: 96, borderWidth: 2, borderColor: c.tinta, borderRadius: 16, padding: 14, textAlignVertical: "top" },
});
