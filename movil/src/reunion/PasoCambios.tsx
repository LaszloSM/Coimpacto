// Paso 2 "Cambios desde la última reunión" (D7, ET3): una propuesta a la vez, con lo que se
// registró, lo que propone la Fundación y el motivo para leer en voz alta. "Aceptar" pasa a las
// firmas de la junta (D10); "No aceptar" pide un motivo de la lista y una nota (D3 = A).

import { formatearPesos } from "@credimpacto/reglas";
import { tokens } from "@credimpacto/tokens";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { FotoGrupo, PropuestaFoto } from "../cola/grupo";
import type { Sesion } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { BotonPrincipal, BotonSecundario, estilos as base, Parrafo, Titulo } from "../ui/componentes";
import { FirmasGrupo } from "./FirmasGrupo";
import { aceptar, MOTIVOS_NO_ACEPTAR, noAceptar, nombreDelRegistro, porResponder, type MotivoNoAceptar } from "./propuestas";
import { PASOS } from "./reunion";

const { color, spacing, tipo } = tokens;

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
          {MOTIVOS_NO_ACEPTAR.map((m) => (
            <Pressable
              key={m.id}
              testID={`motivo-${m.id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: motivo === m.id }}
              onPress={() => setMotivo(m.id)}
              style={estilos.opcion}
            >
              <View style={[estilos.radio, motivo === m.id && estilos.radioElegido]} />
              <Text style={estilos.opcionTexto}>{m.texto}</Text>
            </Pressable>
          ))}
          <Text style={estilos.etiqueta}>Nota (opcional)</Text>
          <TextInput
            testID="nota-no-aceptar"
            style={estilos.nota}
            value={nota}
            onChangeText={setNota}
            maxLength={300}
            multiline
            accessibilityLabel="Nota"
          />
        </ScrollView>
        <View style={base.acciones}>
          <BotonPrincipal
            testID="guardar-no-aceptar"
            texto="Guardar"
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
        </View>
      </>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[1]}</Titulo>
        <Text style={estilos.cuenta}>{lista.length === 1 ? "1 cambio por revisar" : `${lista.length} cambios por revisar`}</Text>
        <Text style={estilos.etiqueta}>Lo que se anotó</Text>
        <Parrafo testID="cambio-registro">
          {nombreDelRegistro(actual.movimiento.tipo)} · {formatearPesos(Math.abs(actual.movimiento.monto))}
          {quien(props.foto, actual.movimiento.titular_id) ? ` · ${quien(props.foto, actual.movimiento.titular_id)}` : ""} · reunión{" "}
          {actual.movimiento.reunion}
        </Parrafo>
        <Text style={estilos.etiqueta}>Lo que propone la Fundación</Text>
        <Parrafo testID="cambio-propuesta">{actual.accion === "anular" ? "Quitarlo del cuaderno" : "Dejarlo como está"}</Parrafo>
        <Text style={estilos.etiqueta}>Para leer en voz alta</Text>
        <Parrafo testID="cambio-voz-alta">{textoEnVozAlta(props.foto, actual)}</Parrafo>
      </ScrollView>
      <View style={base.acciones}>
        <BotonPrincipal testID="aceptar-cambio" texto="Aceptar y firmar" alTocar={() => setModo("firmar")} />
        <BotonSecundario testID="no-aceptar-cambio" texto="No aceptar" alTocar={() => setModo("no_aceptar")} />
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  cuenta: { ...tipo.body, color: color["tinta-suave"], marginBottom: spacing.md },
  etiqueta: { ...tipo.label, color: color["tinta-suave"], marginTop: spacing.md },
  opcion: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: color.renglon },
  opcionTexto: { ...tipo.body, color: color.tinta, flex: 1 },
  // Cuadrado: el sello es el único elemento redondo del sistema (DESIGN.md, Shapes).
  radio: { width: 28, height: 28, borderRadius: 4, borderWidth: 2, borderColor: color.tinta },
  radioElegido: { borderWidth: 9 },
  nota: { ...tipo.body, color: color.tinta, minHeight: 96, borderWidth: 2, borderColor: color.tinta, borderRadius: 8, padding: spacing.sm, textAlignVertical: "top" },
});
