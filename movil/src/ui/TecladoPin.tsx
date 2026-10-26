// PIN privado a pantalla completa (D10): "Pase el celular a: [cargo]", 6 puntos sin eco,
// teclas de 72 dp y "Verificando…" mientras se deriva la llave (EP1). Nunca el teclado del
// sistema (DESIGN.md, superficie nativa). Si el PIN no coincide, los puntos tiemblan una vez.

import { usePreventScreenCapture } from "expo-screen-capture";
import { useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { estilos as base, Pulsable, TOPE_CIFRAS } from "./componentes";
import { Borrar, Candado } from "./iconos";
import { c, LADO, SALIDA, t } from "./tema";
import { tocar } from "./tocar";

const LARGO = 6;
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"] as const;

function Punto({ lleno }: { lleno: boolean }) {
  const s = useSharedValue(lleno ? 1 : 0);
  useEffect(() => {
    s.set(lleno ? withSpring(1, { duration: 220, dampingRatio: 0.6 }) : withTiming(0, { duration: 100 }));
  }, [lleno, s]);
  const tinta = useAnimatedStyle(() => ({ opacity: s.get(), transform: [{ scale: 0.4 + 0.6 * s.get() }] }));
  return (
    <View style={estilos.punto}>
      <Animated.View style={[estilos.puntoTinta, tinta]} />
    </View>
  );
}

export function TecladoPin(props: {
  paraQuien: string;
  /** Mensaje bajo los puntos: "PIN no coincide · quedan 3 intentos", "En pausa"… */
  aviso?: string;
  /** El aviso es una indicación ("Escriba el PIN otra vez"), no un error: no tiembla ni va en rojo. */
  guia?: boolean;
  verificando?: boolean;
  alCompletar: (pin: string) => void;
}) {
  // Sin capturas ni vista previa en apps recientes mientras se escribe un PIN (N12).
  usePreventScreenCapture();
  const [pin, setPin] = useState("");
  const temblor = useSharedValue(0);
  const avisoAntes = useRef(props.aviso);
  // Durante "Verificando…" atrás no hace nada (N11): no se corta una derivación a medias.
  const { verificando, aviso, guia } = props;
  useEffect(() => {
    if (!verificando) return;
    const suscripcion = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => suscripcion.remove();
  }, [verificando]);
  // Un aviso nuevo (PIN que no coincide, en pausa) hace temblar los puntos y vibra una vez.
  useEffect(() => {
    if (aviso && !guia && aviso !== avisoAntes.current) {
      tocar.mal();
      temblor.set(
        withSequence(
          withTiming(-10, { duration: 50 }),
          withTiming(9, { duration: 70 }),
          withTiming(-6, { duration: 70 }),
          withTiming(3, { duration: 60 }),
          withTiming(0, { duration: 60, easing: SALIDA }),
        ),
      );
    }
    avisoAntes.current = aviso;
  }, [aviso, guia, temblor]);
  const tiembla = useAnimatedStyle(() => ({ transform: [{ translateX: temblor.get() }] }));

  const tocarTecla = (tecla: (typeof TECLAS)[number]) => {
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
      <View style={estilos.cabeza}>
        <View style={estilos.candado}>
          <Candado size={26} color={c.naranja} weight="duotone" />
        </View>
        <Text style={estilos.pase}>Pase el celular a:</Text>
        <Text accessibilityRole="header" style={estilos.quien} testID="pin-para" numberOfLines={2} adjustsFontSizeToFit>
          {props.paraQuien}
        </Text>
      </View>
      <Animated.View style={[estilos.puntos, tiembla]} accessible accessibilityLabel={`${pin.length} de ${LARGO} números escritos`}>
        {Array.from({ length: LARGO }, (_, i) => (
          <Punto key={i} lleno={i < pin.length} />
        ))}
      </Animated.View>
      <Text style={[estilos.aviso, props.aviso && !props.guia && !props.verificando ? estilos.avisoMal : null]} testID="pin-aviso" accessibilityLiveRegion="polite">
        {props.verificando ? "Verificando…" : (props.aviso ?? "Escriba su PIN de 6 números.")}
      </Text>
      <View style={estilos.teclado}>
        {TECLAS.map((tecla, i) =>
          tecla ? (
            <Pulsable
              key={i}
              testID={`tecla-${tecla}`}
              disabled={props.verificando}
              accessibilityRole="button"
              accessibilityLabel={tecla === "borrar" ? "Borrar" : tecla}
              onPress={() => tocarTecla(tecla)}
              vibra="paso"
              escala={0.92}
              style={[estilos.tecla, tecla === "borrar" && estilos.teclaBorrar, props.verificando && { opacity: 0.5 }]}
              estiloPresionado={estilos.teclaPresionada}
            >
              {tecla === "borrar" ? (
                <Borrar size={30} color={c.tinta} weight="bold" />
              ) : (
                <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={estilos.textoTecla}>
                  {tecla}
                </Text>
              )}
            </Pulsable>
          ) : (
            <View key={i} style={[estilos.tecla, estilos.teclaVacia]} />
          ),
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { paddingHorizontal: LADO, paddingTop: 28, paddingBottom: 16, justifyContent: "space-between" },
  cabeza: { alignItems: "center", gap: 6 },
  candado: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: c.naranjaTinte,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pase: { ...t.label, fontSize: 17, color: c.suave },
  quien: { ...t["campo-titulo"], color: c.tinta, textAlign: "center" },
  puntos: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 },
  punto: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.renglonFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  puntoTinta: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.tinta },
  aviso: { ...t.body, fontSize: 17, color: c.suave, textAlign: "center", minHeight: 48 },
  avisoMal: { color: c.mal },
  teclado: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  tecla: {
    width: "31.5%",
    minHeight: 72,
    borderRadius: 20,
    backgroundColor: c.hueco,
    alignItems: "center",
    justifyContent: "center",
  },
  teclaBorrar: { backgroundColor: "transparent" },
  teclaPresionada: { backgroundColor: c.renglonFuerte },
  teclaVacia: { backgroundColor: "transparent" },
  textoTecla: { ...t["cifra-renglon"], fontSize: 32, lineHeight: 38, color: c.tinta },
});
