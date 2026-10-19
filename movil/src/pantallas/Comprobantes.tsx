// Comprobantes de la reunión pasada (pregunta 2b, valor por defecto: QR en la siguiente reunión).
// La junta abre la lista, toca el número del miembro y le muestra su QR; el miembro lo escanea
// con su celular y ve las cifras confirmadas por la Fundación. Solo números, nunca nombres.

import { tokens } from "@credimpacto/tokens";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { FotoGrupo } from "../cola/grupo";
import { CodigoQr } from "../ui/CodigoQr";
import { BotonPrincipal, BotonSecundario, estilos as base, Parrafo, Titulo } from "../ui/componentes";

const { color, tipo, spacing } = tokens;

const numero = (n: number) => `#${String(n).padStart(2, "0")}`;
const fecha = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long" });

export function enlaceComprobante(servidor: string, token: string): string {
  return `${servidor}/comprobante/${token}`;
}

export function Comprobantes(props: { foto: FotoGrupo | null; servidor: string; alSalir: () => void }) {
  const { width } = useWindowDimensions();
  const [elegido, setElegido] = useState<number | null>(null);
  const datos = props.foto?.comprobantes;
  const lista = (props.foto?.miembros ?? [])
    .filter((m) => datos?.enlaces[m.titular_id])
    .map((m) => ({ numero: m.numero, token: datos!.enlaces[m.titular_id] }));

  if (!datos || lista.length === 0) {
    return (
      <>
        <View style={base.contenido}>
          <Titulo>Comprobantes</Titulo>
          <Parrafo testID="comprobantes-vacio">
            Todavía no hay comprobantes. Aparecen cuando la Fundación confirma una reunión cerrada y este celular se
            conecta.
          </Parrafo>
        </View>
        <View style={base.acciones}>
          <BotonSecundario testID="comprobantes-volver" texto="Volver al inicio" alTocar={props.alSalir} />
        </View>
      </>
    );
  }

  const actual = elegido === null ? null : lista[elegido];
  if (actual) {
    const lado = Math.min(width - 40, 360);
    return (
      <>
        <ScrollView contentContainerStyle={base.contenido}>
          <Text style={estilos.numero} accessibilityRole="header" testID="comprobante-numero">
            {numero(actual.numero)}
          </Text>
          <Parrafo>
            Reunión {datos.reunion} · {fecha(datos.fecha)}. Escanee con la cámara de su celular para ver su comprobante.
          </Parrafo>
          <View style={estilos.qr}>
            <CodigoQr
              testID="comprobante-qr"
              texto={enlaceComprobante(props.servidor, actual.token)}
              lado={lado}
              etiqueta={`Comprobante de ${numero(actual.numero)}`}
            />
          </View>
          <Parrafo>Sirve hasta el {fecha(datos.vence_en)}.</Parrafo>
        </ScrollView>
        <View style={base.acciones}>
          {elegido! + 1 < lista.length ? (
            <BotonPrincipal
              testID="comprobante-siguiente"
              texto={`Siguiente: ${numero(lista[elegido! + 1].numero)}`}
              alTocar={() => setElegido(elegido! + 1)}
            />
          ) : null}
          <BotonSecundario testID="comprobante-lista" texto="Volver a la lista" alTocar={() => setElegido(null)} />
        </View>
      </>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>Comprobantes de la reunión {datos.reunion}</Titulo>
        <Parrafo>Toque el número de cada miembro para mostrarle su código.</Parrafo>
        {lista.map((m, i) => (
          <Pressable
            key={m.numero}
            testID={`comprobante-${m.numero}`}
            accessibilityRole="button"
            onPress={() => setElegido(i)}
            style={({ pressed }) => [estilos.renglon, pressed && { backgroundColor: color["papel-oficina"] }]}
          >
            <Text style={estilos.renglonTexto}>{numero(m.numero)}</Text>
            <Text style={estilos.renglonDetalle}>Mostrar código</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={base.acciones}>
        <BotonSecundario testID="comprobantes-volver" texto="Volver al inicio" alTocar={props.alSalir} />
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  numero: { ...tipo["campo-titulo"], color: color.tinta, marginTop: spacing.lg, marginBottom: spacing.sm },
  qr: { alignItems: "center", marginVertical: spacing.lg },
  renglon: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: color.renglon,
  },
  renglonTexto: { ...tipo["cifra-renglon"], color: color.tinta },
  renglonDetalle: { ...tipo.body, color: color.tinta, textDecorationLine: "underline" },
});
