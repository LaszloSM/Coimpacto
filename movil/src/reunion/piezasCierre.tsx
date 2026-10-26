// Piezas visuales del cierre, sin datos: el billete con su color real (y el fajo que crece al
// contar), la fila de conteo con sus teclas y el sello «Bien contado» que cae al firmar.

import { formatearPesos } from "@credimpacto/reglas";
import { useEffect } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import { Pulsable, TOPE_CIFRAS } from "../ui/componentes";
import { Mas, Menos } from "../ui/iconos";
import { c, SALIDA, t } from "../ui/tema";
import { tocar } from "../ui/tocar";

// El color real de cada billete de la familia nueva del Banco de la República.
const COLOR_BILLETE: Record<number, string> = {
  100_000: "#3C8C4A",
  50_000: "#7D4A9E",
  20_000: "#E9822F",
  10_000: "#C8332B",
  5_000: "#8A5A3B",
  2_000: "#2E7FC1",
};
const NOMBRE_COLOR: Record<number, string> = {
  100_000: "verde",
  50_000: "violeta",
  20_000: "naranja",
  10_000: "rojo",
  5_000: "café",
  2_000: "azul",
};
// Las monedas: dorada, plateada o de dos metales.
const COLOR_MONEDA: Record<number, [string, string]> = {
  1_000: ["#C9A227", "#B8BEC6"],
  500: ["#B8BEC6", "#C9A227"],
  200: ["#B8BEC6", "#B8BEC6"],
  100: ["#C9A227", "#C9A227"],
  50: ["#B8BEC6", "#B8BEC6"],
};

const corto = (valor: number) => (valor >= 1_000 ? `${valor / 1_000} mil` : String(valor));

/** El billete (o la moneda) con su color, y detrás tantos como se hayan contado, hasta tres. */
function Denominacion({ valor, cuenta, moneda }: { valor: number; cuenta: number; moneda: boolean }) {
  const golpe = useSharedValue(0);
  useEffect(() => {
    if (cuenta > 0) golpe.set(withSequence(withTiming(-5, { duration: 70, easing: SALIDA }), withTiming(0, { duration: 160, easing: SALIDA })));
  }, [cuenta, golpe]);
  const cae = useAnimatedStyle(() => ({ transform: [{ translateY: golpe.get() }] }));
  if (moneda) {
    const [aro, centro] = COLOR_MONEDA[valor] ?? [c.renglonFuerte, c.renglonFuerte];
    return (
      <Animated.View style={[estilos.moneda, { backgroundColor: aro }, cae]}>
        <View style={[estilos.monedaCentro, { backgroundColor: centro }]}>
          <Text style={estilos.monedaTexto}>{valor}</Text>
        </View>
      </Animated.View>
    );
  }
  const color = COLOR_BILLETE[valor] ?? c.renglonFuerte;
  const capas = Math.min(cuenta, 3);
  return (
    <View style={estilos.fajo}>
      {Array.from({ length: capas > 1 ? capas - 1 : 0 }, (_, i) => (
        <View key={i} style={[estilos.billete, estilos.billeteDetras, { backgroundColor: color, top: -(i + 1) * 3, left: (i + 1) * 3, opacity: 0.35 + i * 0.15 }]} />
      ))}
      <Animated.View style={[estilos.billete, { backgroundColor: color }, cae]}>
        <View style={estilos.billeteMarco}>
          <Text style={estilos.billeteTexto}>{corto(valor)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export function FilaConteo(props: { valor: number; cuenta: number; moneda: boolean; alCambiar: (n: number) => void }) {
  const { width, fontScale } = useWindowDimensions();
  // En celulares angostos o con letra grande, el billete y su subtotal van arriba y las teclas abajo.
  const apilado = width < 360 || fontScale > 1.15;
  const id = `cuenta-${props.valor}`;
  const etiqueta = `${formatearPesos(props.valor)}${NOMBRE_COLOR[props.valor] ? `, ${NOMBRE_COLOR[props.valor]}` : ""}`;
  const dato = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={[estilos.conteoNombre, props.cuenta === 0 && { color: c.tenue }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatearPesos(props.cuenta * props.valor)}
      </Text>
      <Text style={estilos.conteoSub} numberOfLines={1}>
        {props.moneda ? `de ${formatearPesos(props.valor)}` : (NOMBRE_COLOR[props.valor] ?? "")}
      </Text>
    </View>
  );
  const teclas = (
    <View style={estilos.teclasConteo}>
      <Pulsable
        testID={`${id}-menos`}
        accessibilityRole="button"
        accessibilityLabel={`Menos ${etiqueta}`}
        disabled={props.cuenta === 0}
        onPress={() => props.alCambiar(props.cuenta - 1)}
        vibra="paso"
        escala={0.92}
        style={[estilos.teclaConteo, props.cuenta === 0 && { opacity: 0.35 }]}
        estiloPresionado={{ backgroundColor: c.renglon }}
      >
        <Menos size={24} color={c.tinta} weight="bold" />
      </Pulsable>
      <Text testID={`${id}-valor`} maxFontSizeMultiplier={TOPE_CIFRAS} style={estilos.conteoValor} accessibilityLabel={`${etiqueta}: ${props.cuenta}`}>
        {props.cuenta}
      </Text>
      <Pulsable
        testID={`${id}-mas`}
        accessibilityRole="button"
        accessibilityLabel={`Más ${etiqueta}`}
        disabled={props.cuenta >= 999}
        onPress={() => props.alCambiar(props.cuenta + 1)}
        vibra="paso"
        escala={0.92}
        style={[estilos.teclaConteo, estilos.teclaConteoMas]}
        estiloPresionado={{ backgroundColor: "#1B3A6B" }}
      >
        <Mas size={24} color={c.papel} weight="bold" />
      </Pulsable>
    </View>
  );
  if (apilado) {
    return (
      <View style={[estilos.filaConteo, estilos.filaConteoApilada]}>
        <View style={estilos.filaConteoArriba}>
          <Denominacion valor={props.valor} cuenta={props.cuenta} moneda={props.moneda} />
          {dato}
        </View>
        {teclas}
      </View>
    );
  }
  return (
    <View style={estilos.filaConteo}>
      <Denominacion valor={props.valor} cuenta={props.cuenta} moneda={props.moneda} />
      {dato}
      {teclas}
    </View>
  );
}

/** El sello «Bien contado»: cae desde 1,5 a 1 en 260 ms (salida fuerte, sin rebote), el celular
 * vibra cuando toca el papel y la tinta se corre un poco alrededor. Con "Quitar animaciones"
 * aparece quieto (DESIGN.md, Motion). Es el único elemento torcido del sistema. */
export function Sello(props: { acap: string; fecha: string }) {
  const quieto = useReducedMotion();
  const caida = useSharedValue(quieto ? 1 : 0);
  const tinta = useSharedValue(0);

  useEffect(() => {
    if (quieto) return;
    caida.set(withTiming(1, { duration: 260, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    tinta.set(withDelay(200, withTiming(1, { duration: 520, easing: SALIDA })));
    const golpe = setTimeout(() => tocar.sello(), 200);
    return () => clearTimeout(golpe);
  }, [quieto, caida, tinta]);

  const sello = useAnimatedStyle(() => ({
    opacity: Math.min(1, caida.get() * 1.8),
    transform: [{ rotate: "-8deg" }, { scale: 1.5 - 0.5 * caida.get() }],
  }));
  const corrida = useAnimatedStyle(() => ({
    opacity: 0.3 * (1 - tinta.get()),
    transform: [{ scale: 1 + 0.22 * tinta.get() }],
  }));

  const fecha = new Date(`${props.fecha}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  return (
    <View style={estilos.selloMarco}>
      <Animated.View style={[estilos.selloCorrida, corrida]} />
      <Animated.View testID="sello" accessible accessibilityLabel="Reunión cerrada. Bien contado." style={[estilos.sello, sello]}>
        <View style={estilos.selloInterior}>
          <Text style={estilos.selloArriba} numberOfLines={1} adjustsFontSizeToFit>
            {props.acap}
          </Text>
          <View style={estilos.selloFranja}>
            <Text style={estilos.selloTexto}>BIEN</Text>
            <Text style={estilos.selloTexto}>CONTADO</Text>
          </View>
          <Text style={estilos.selloAbajo}>{fecha}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  filaConteo: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.renglonFuerte,
  },
  fajo: { width: 66, height: 44, justifyContent: "center" },
  billete: {
    width: 60,
    height: 38,
    borderRadius: 7,
    padding: 3,
    shadowColor: c.tinta,
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  billeteDetras: { position: "absolute", elevation: 0, shadowOpacity: 0 },
  billeteMarco: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  billeteTexto: { ...t["body-fuerte"], fontSize: 14, lineHeight: 17, color: "#FFFFFF" },
  moneda: { width: 46, height: 46, borderRadius: 23, padding: 5, marginHorizontal: 12, alignItems: "center", justifyContent: "center" },
  monedaCentro: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  monedaTexto: { ...t["body-fuerte"], fontSize: 12, lineHeight: 14, color: c.tinta },
  conteoNombre: { ...t["cifra-renglon"], fontSize: 19, lineHeight: 24, color: c.tinta },
  conteoSub: { ...t.label, fontSize: 14, color: c.suave, marginTop: 2 },
  filaConteoApilada: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  filaConteoArriba: { flexDirection: "row", alignItems: "center", gap: 10 },
  teclasConteo: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  teclaConteo: { width: 50, height: 50, borderRadius: 14, backgroundColor: c.hueco, alignItems: "center", justifyContent: "center" },
  teclaConteoMas: { backgroundColor: c.tinta },
  conteoValor: { ...t["cifra-renglon"], fontSize: 24, minWidth: 30, textAlign: "center", color: c.tinta },
  selloMarco: { width: 230, height: 230, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  selloCorrida: { position: "absolute", width: 206, height: 206, borderRadius: 103, borderWidth: 10, borderColor: c.bien },
  sello: {
    width: 206,
    height: 206,
    borderRadius: 103,
    borderWidth: 4,
    borderColor: c.bien,
    padding: 7,
    backgroundColor: "rgba(227, 242, 232, 0.55)",
  },
  selloInterior: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: c.bien,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 6,
  },
  selloArriba: { ...t.label, fontSize: 13, color: c.bien, letterSpacing: 1, textTransform: "uppercase" },
  selloFranja: { alignSelf: "stretch", alignItems: "center", borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: c.bien, paddingVertical: 6 },
  selloTexto: { ...t["campo-titulo"], fontSize: 28, lineHeight: 30, color: c.bien, letterSpacing: 1 },
  selloAbajo: { ...t.label, fontSize: 13, color: c.bien },
});
