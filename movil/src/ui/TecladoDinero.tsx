// Teclado de dinero (DESIGN.md "Dinero"): teclas de 60 dp con atajo 000, la cifra grande con su
// valor en letras arriba y el aviso si algo no cuadra. Solo en abonos y préstamos (D11): el
// resto de la reunión va con toques. Cada tecla vibra un toque corto.

import { StyleSheet, Text, View } from "react-native";

import { Dinero, Pulsable, TOPE_CIFRAS } from "./componentes";
import { Alerta, Borrar } from "./iconos";
import { c, t } from "./tema";

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
    <View style={estilos.marco}>
      <View style={[estilos.cifra, props.aviso ? estilos.cifraAviso : null]}>
        <Dinero testID={`${props.testID ?? "dinero"}-valor`} pesos={props.valor} etiqueta={props.etiqueta} grande />
        {props.aviso ? (
          <View style={estilos.aviso}>
            <Alerta size={18} color={c.aviso} weight="bold" />
            <Text style={estilos.avisoTexto} accessibilityLiveRegion="polite">
              {props.aviso}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={estilos.teclado}>
        {TECLAS.map((tecla) => (
          <Pulsable
            key={tecla}
            testID={`${props.testID ?? "dinero"}-${tecla}`}
            accessibilityRole="button"
            accessibilityLabel={tecla === "borrar" ? "Borrar" : tecla === "000" ? "Tres ceros" : tecla}
            onPress={() => tocar(tecla)}
            vibra="paso"
            escala={0.94}
            style={[estilos.tecla, tecla === "borrar" && estilos.teclaBorrar]}
            estiloPresionado={estilos.teclaPresionada}
          >
            {tecla === "borrar" ? (
              <Borrar size={28} color={c.tinta} weight="bold" />
            ) : (
              <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={tecla === "000" ? estilos.textoCeros : estilos.texto}>
                {tecla}
              </Text>
            )}
          </Pulsable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { gap: 14, marginTop: 8 },
  cifra: {
    borderWidth: 2,
    borderColor: c.tinta,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: c.papel,
  },
  cifraAviso: { borderColor: c.aviso },
  aviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: c.avisoTinte,
  },
  avisoTexto: { ...t.body, fontSize: 16, lineHeight: 21, color: c.aviso, flex: 1 },
  teclado: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  tecla: {
    width: "31.5%",
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: c.hueco,
    alignItems: "center",
    justifyContent: "center",
  },
  teclaBorrar: { backgroundColor: c.renglon },
  teclaPresionada: { backgroundColor: c.renglonFuerte },
  texto: { ...t["cifra-renglon"], fontSize: 28, lineHeight: 32, color: c.tinta },
  textoCeros: { ...t["cifra-renglon"], fontSize: 22, lineHeight: 28, color: c.tinta },
});
