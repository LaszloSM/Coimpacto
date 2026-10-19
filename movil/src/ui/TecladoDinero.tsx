// Teclado de dinero (DESIGN.md "Dinero"): teclas de 56 dp con atajo 000 y la cifra con su
// valor en letras arriba. Solo en abonos y préstamos (D11): el resto de la reunión va con toques.

import { tokens } from "@credimpacto/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Dinero, TOPE_CIFRAS } from "./componentes";

const { color, tipo, spacing, componentes } = tokens;
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "borrar"] as const;
/** Tope de lo que se puede escribir (cien millones): evita ceros de más por error. */
const MAXIMO = 100_000_000;

export function TecladoDinero(props: {
  valor: number;
  etiqueta: string;
  alCambiar: (pesos: number) => void;
  aviso?: string;
  testID?: string;
}) {
  const tocar = (tecla: (typeof TECLAS)[number]) => {
    if (tecla === "borrar") return props.alCambiar(Math.floor(props.valor / 10));
    const nuevo = Number(`${props.valor}${tecla}`);
    if (nuevo <= MAXIMO) props.alCambiar(nuevo);
  };
  return (
    <View>
      <View style={estilos.cifra}>
        <Dinero testID={`${props.testID ?? "dinero"}-valor`} pesos={props.valor} etiqueta={props.etiqueta} grande />
        {props.aviso ? (
          <Text style={estilos.aviso} accessibilityLiveRegion="polite">
            {props.aviso}
          </Text>
        ) : null}
      </View>
      <View style={estilos.teclado}>
        {TECLAS.map((tecla) => (
          <Pressable
            key={tecla}
            testID={`${props.testID ?? "dinero"}-${tecla}`}
            accessibilityRole="button"
            accessibilityLabel={tecla === "borrar" ? "Borrar" : tecla === "000" ? "Tres ceros" : tecla}
            onPress={() => tocar(tecla)}
            style={({ pressed }) => [estilos.tecla, pressed && { backgroundColor: color.renglon }]}
          >
            <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={tecla === "borrar" ? estilos.textoBorrar : estilos.texto}>
              {tecla === "borrar" ? "Borrar" : tecla}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cifra: {
    borderWidth: 2,
    borderColor: componentes.dinero.borderColor,
    borderRadius: componentes.dinero.rounded,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  aviso: {
    ...tipo.body,
    color: color["por-validar"],
    backgroundColor: color["por-validar-tinte"],
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: 4,
  },
  teclado: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm },
  tecla: {
    width: "31%",
    minHeight: componentes.tecla.height,
    borderRadius: componentes.tecla.rounded,
    borderWidth: 1,
    borderColor: componentes.tecla.borderColor,
    backgroundColor: componentes.tecla.backgroundColor,
    alignItems: "center",
    justifyContent: "center",
  },
  texto: { ...tipo["cifra-renglon"], fontSize: 26, color: color.tinta },
  textoBorrar: { ...tipo.label, fontSize: 18, color: color.tinta },
});
