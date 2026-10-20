// PIN privado a pantalla completa (D10): "Pase el celular a: [cargo]", 6 puntos sin eco,
// teclas de 64 dp o más y "Verificando…" mientras se deriva la llave (EP1). Nunca el teclado
// del sistema (DESIGN.md, superficie nativa).

import { tokens } from "@credimpacto/tokens";
import { usePreventScreenCapture } from "expo-screen-capture";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";

import { estilos as base, TOPE_CIFRAS } from "./componentes";

const { color, tipo, spacing, componentes } = tokens;
const LARGO = 6;
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"] as const;

export function TecladoPin(props: {
  paraQuien: string;
  /** Mensaje bajo los puntos: "PIN no coincide · quedan 3 intentos", "En pausa"… */
  aviso?: string;
  verificando?: boolean;
  alCompletar: (pin: string) => void;
}) {
  // Sin capturas ni vista previa en apps recientes mientras se escribe un PIN (N12).
  usePreventScreenCapture();
  const [pin, setPin] = useState("");
  // Durante "Verificando…" atrás no hace nada (N11): no se corta una derivación a medias.
  const { verificando } = props;
  useEffect(() => {
    if (!verificando) return;
    const suscripcion = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => suscripcion.remove();
  }, [verificando]);

  const tocar = (tecla: (typeof TECLAS)[number]) => {
    if (props.verificando) return;
    if (tecla === "borrar") return setPin((p) => p.slice(0, -1));
    if (!tecla) return;
    const nuevo = (pin + tecla).slice(0, LARGO);
    setPin(nuevo);
    if (nuevo.length === LARGO) {
      setPin("");
      props.alCompletar(nuevo);
    }
  };

  return (
    <View style={[base.pantalla, estilos.contenedor]}>
      <Text style={base.etiqueta}>Pase el celular a:</Text>
      <Text accessibilityRole="header" style={base.titulo} testID="pin-para">
        {props.paraQuien}
      </Text>
      <View style={estilos.puntos} accessible accessibilityLabel={`${pin.length} de ${LARGO} números escritos`}>
        {Array.from({ length: LARGO }, (_, i) => (
          <View key={i} style={[estilos.punto, i < pin.length && estilos.puntoLleno]} />
        ))}
      </View>
      <Text style={[base.parrafo, estilos.aviso]} testID="pin-aviso" accessibilityLiveRegion="polite">
        {props.verificando ? "Verificando…" : (props.aviso ?? " ")}
      </Text>
      <View style={estilos.teclado}>
        {TECLAS.map((tecla, i) => (
          <Pressable
            key={i}
            testID={tecla ? `tecla-${tecla}` : undefined}
            disabled={!tecla || props.verificando}
            accessibilityRole={tecla ? "button" : undefined}
            accessibilityLabel={tecla === "borrar" ? "Borrar" : tecla || undefined}
            onPress={() => tocar(tecla)}
            style={({ pressed }) => [estilos.tecla, !tecla && estilos.teclaVacia, pressed && { backgroundColor: color.renglon }]}
          >
            <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={tecla === "borrar" ? estilos.textoBorrar : estilos.textoTecla}>
              {tecla === "borrar" ? "Borrar" : tecla}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { paddingHorizontal: 20, paddingTop: spacing["2xl"], alignItems: "stretch" },
  puntos: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginVertical: spacing.lg },
  // Cuadrados con radio sm: el sello es el único elemento redondo (DESIGN.md, Shapes).
  punto: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: color.tinta },
  puntoLleno: { backgroundColor: color.tinta },
  aviso: { textAlign: "center", minHeight: 28, marginBottom: spacing.md },
  teclado: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm },
  tecla: {
    width: "31%",
    minHeight: 72,
    borderRadius: componentes.tecla.rounded,
    borderWidth: 1,
    borderColor: componentes.tecla.borderColor,
    backgroundColor: componentes.tecla.backgroundColor,
    alignItems: "center",
    justifyContent: "center",
  },
  teclaVacia: { backgroundColor: "transparent", borderWidth: 0 },
  textoTecla: { ...tipo["cifra-renglon"], fontSize: 30, color: color.tinta },
  textoBorrar: { ...tipo.label, fontSize: 18, color: color.tinta },
});
