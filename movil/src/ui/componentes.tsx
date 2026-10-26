// Componentes de la superficie de reunión (DESIGN.md: cuaderno, un solo botón naranja,
// renglones sin tarjetas, cifras grandes con su valor en letras, toques ≥ 56 dp).

import { enLetras, formatearPesos } from "@credimpacto/reglas";
import { tokens } from "@credimpacto/tokens";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const { color, tipo, spacing, componentes } = tokens;

/** Cifras y teclas crecen con la letra del sistema hasta 1,3× (N10). */
export const TOPE_CIFRAS = 1.3;

/** La barra de 9 segmentos solo cabe con ≥ 360 dp y letra ≤ 1,3×; si no, queda el texto (N10). */
export function mostrarSegmentos(ancho: number, escalaLetra: number): boolean {
  return ancho >= 360 && escalaLetra <= TOPE_CIFRAS;
}

export function BotonPrincipal(props: {
  texto: string;
  alTocar: () => void;
  /** Si falta algo, el botón lo dice en vez de quedar gris y mudo (DESIGN.md). */
  falta?: string;
  testID?: string;
}) {
  const deshabilitado = Boolean(props.falta);
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={props.alTocar}
      style={({ pressed }) => [
        estilos.boton,
        deshabilitado
          ? estilos.botonDeshabilitado
          : { backgroundColor: pressed ? color["naranja-presionado"] : color.naranja },
      ]}
    >
      <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={[estilos.botonTexto, deshabilitado && estilos.textoDeshabilitado]}>
        {props.falta ?? props.texto}
      </Text>
    </Pressable>
  );
}

export function BotonSecundario(props: { texto: string; alTocar: () => void; detalle?: string; testID?: string }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      onPress={props.alTocar}
      style={({ pressed }) => [estilos.boton, estilos.botonSecundario, pressed && { backgroundColor: color["papel-oficina"] }]}
    >
      <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={estilos.botonTexto} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        {props.texto}
      </Text>
      {props.detalle ? <Text style={estilos.cifraRenglonPequena}>{props.detalle}</Text> : null}
    </Pressable>
  );
}

/** Franja fija: estado de guardado (D5, en calma) y paso del asistente (D1). */
export function Franja(props: { porSubir: number; paso?: number; totalPasos?: number }) {
  const { width, fontScale } = useWindowDimensions();
  const guardado =
    props.porSubir === 0 ? "Nada por subir" : `Guardado en este celular · ${props.porSubir} por subir`;
  return (
    <View
      style={estilos.franja}
      accessibilityRole="summary"
      accessible
      accessibilityLabel={props.paso ? `${guardado}. Paso ${props.paso} de ${props.totalPasos ?? 9}.` : guardado}
    >
      <View style={estilos.franjaFila}>
        <Text style={estilos.franjaTexto} testID="franja-guardado">
          {guardado}
        </Text>
        {props.paso ? (
          <Text style={estilos.franjaTexto} testID="franja-paso">
            Paso {props.paso} de {props.totalPasos ?? 9}
          </Text>
        ) : null}
      </View>
      {props.paso && mostrarSegmentos(width, fontScale) ? (
        <View style={estilos.segmentos} importantForAccessibility="no-hide-descendants">
          {Array.from({ length: props.totalPasos ?? 9 }, (_, i) => (
            <View
              key={i}
              style={[estilos.segmento, { backgroundColor: i < props.paso! ? color.navy : color.renglon }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Titulo(props: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={estilos.titulo}>
      {props.children}
    </Text>
  );
}

export function Parrafo(props: { children: ReactNode; testID?: string }) {
  return (
    <Text testID={props.testID} style={estilos.parrafo}>
      {props.children}
    </Text>
  );
}

/** Cifra de dinero con su valor en letras debajo (D17 de diseño). */
export function Dinero(props: { pesos: number; etiqueta?: string; grande?: boolean; testID?: string }) {
  return (
    <View accessible accessibilityLabel={`${props.etiqueta ? `${props.etiqueta}: ` : ""}${enLetras(props.pesos)}`}>
      {props.etiqueta ? <Text style={estilos.etiqueta}>{props.etiqueta}</Text> : null}
      <Text
        testID={props.testID}
        maxFontSizeMultiplier={TOPE_CIFRAS}
        style={props.grande ? estilos.cifraClave : estilos.cifraRenglon}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatearPesos(props.pesos)}
      </Text>
      <Text style={estilos.letras}>{enLetras(props.pesos)}</Text>
    </View>
  );
}

/** Contador − n + con botones de 64 dp (D11). */
export function Contador(props: {
  etiqueta: string;
  valor: number;
  minimo?: number;
  maximo: number;
  alCambiar: (n: number) => void;
  testID?: string;
}) {
  const minimo = props.minimo ?? 0;
  const { width, fontScale } = useWindowDimensions();
  const apilado = width < 360 || fontScale > 1.15;
  const tecla = (texto: string, delta: number, habilitada: boolean, nombre: string) => (
    <Pressable
      testID={`${props.testID ?? "contador"}-${delta > 0 ? "mas" : "menos"}`}
      accessibilityRole="button"
      accessibilityLabel={`${nombre} ${props.etiqueta}`}
      accessibilityState={{ disabled: !habilitada }}
      disabled={!habilitada}
      onPress={() => props.alCambiar(props.valor + delta)}
      style={({ pressed }) => [estilos.teclaContador, !habilitada && { opacity: 0.4 }, pressed && { backgroundColor: color.renglon }]}
    >
      <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={estilos.teclaContadorTexto}>
        {texto}
      </Text>
    </Pressable>
  );
  const valor = (
    <Text
      testID={`${props.testID ?? "contador"}-valor`}
      maxFontSizeMultiplier={TOPE_CIFRAS}
      style={[estilos.cifraRenglon, { minWidth: 44, textAlign: "center" }]}
      accessibilityLabel={`${props.etiqueta}: ${props.valor}`}
    >
      {props.valor}
    </Text>
  );
  if (apilado) {
    return (
      <View style={[estilos.renglon, estilos.renglonApilado]}>
        <Text style={estilos.parrafo}>{props.etiqueta}</Text>
        <View style={estilos.filaTeclas}>
          {tecla("−", -1, props.valor > minimo, "Menos")}
          {valor}
          {tecla("+", 1, props.valor < props.maximo, "Más")}
        </View>
      </View>
    );
  }
  return (
    <View style={estilos.renglon}>
      <Text style={[estilos.parrafo, { flex: 1 }]}>{props.etiqueta}</Text>
      {tecla("−", -1, props.valor > minimo, "Menos")}
      {valor}
      {tecla("+", 1, props.valor < props.maximo, "Más")}
    </View>
  );
}

/** Casilla de un renglón (fondo social premarcado, presente / ausente). */
export function Casilla(props: { texto: string; marcada: boolean; alCambiar: (v: boolean) => void; detalle?: string; testID?: string }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.marcada }}
      onPress={() => props.alCambiar(!props.marcada)}
      style={estilos.renglon}
    >
      <View style={[estilos.caja, props.marcada && estilos.cajaMarcada]}>
        {props.marcada ? <Text style={estilos.chulo}>✓</Text> : null}
      </View>
      <Text style={[estilos.parrafo, { flex: 1 }]}>{props.texto}</Text>
      {props.detalle ? <Text style={estilos.cifraRenglonPequena}>{props.detalle}</Text> : null}
    </Pressable>
  );
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.papel },
  contenido: { paddingHorizontal: 20, paddingBottom: spacing.lg },
  acciones: {
    paddingHorizontal: 20,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: color.renglon,
    backgroundColor: color.papel,
  },
  boton: {
    minHeight: componentes["button-primary"].height,
    borderRadius: componentes["button-primary"].rounded,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  botonSecundario: { backgroundColor: color.papel, borderWidth: 2, borderColor: color.tinta },
  botonDeshabilitado: {
    backgroundColor: componentes["button-disabled"].backgroundColor,
    borderWidth: 1,
    borderColor: componentes["button-disabled"].borderColor,
  },
  botonTexto: { ...tipo.body, fontFamily: tipo["campo-titulo"].fontFamily, fontSize: 20, color: color.tinta },
  textoDeshabilitado: { color: color["tinta-suave"] },
  franja: { paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: color.renglon },
  franjaFila: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
  franjaTexto: { ...tipo.label, fontSize: 16, color: color["tinta-suave"] },
  segmentos: { flexDirection: "row", gap: 4, marginTop: spacing.sm },
  segmento: { flex: 1, height: 6, borderRadius: 2 },
  titulo: { ...tipo["campo-titulo"], color: color.tinta, marginTop: spacing.lg, marginBottom: spacing.md },
  parrafo: { ...tipo.body, color: color.tinta },
  etiqueta: { ...tipo.label, fontSize: 16, color: color["tinta-suave"] },
  letras: { ...tipo.body, color: color["tinta-suave"] },
  cifraClave: { ...tipo["cifra-clave"], color: color.tinta },
  cifraRenglon: { ...tipo["cifra-renglon"], color: color.tinta },
  cifraRenglonPequena: { ...tipo["cifra-renglon"], fontSize: 18, color: color.tinta },
  renglon: {
    minHeight: componentes.renglon.height,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: componentes.renglon.borderColor,
  },
  renglonApilado: { flexDirection: "column", alignItems: "stretch", gap: spacing.sm, paddingVertical: spacing.sm },
  filaTeclas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teclaContador: {
    width: 64,
    height: 64,
    borderRadius: componentes.tecla.rounded,
    borderWidth: 1,
    borderColor: componentes.tecla.borderColor,
    backgroundColor: componentes.tecla.backgroundColor,
    alignItems: "center",
    justifyContent: "center",
  },
  teclaContadorTexto: { ...tipo["cifra-renglon"], fontSize: 28, color: color.tinta },
  caja: { width: 32, height: 32, borderRadius: 4, borderWidth: 2, borderColor: color.tinta, alignItems: "center", justifyContent: "center" },
  cajaMarcada: { backgroundColor: color.tinta },
  chulo: { color: color.papel, fontSize: 20, fontFamily: tipo["campo-titulo"].fontFamily },
});
