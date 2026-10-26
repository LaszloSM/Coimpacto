// Componentes de la reunión: la libreta de la ACAP. Renglones con el número a la izquierda del
// margen naranja, un solo botón naranja por pantalla, cifras grandes con su valor en letras,
// teclas de 56 dp o más y respuesta al dedo en el mismo instante (escala y vibración).

import { enLetras, formatearPesos } from "@credimpacto/reglas";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { Atras, Chulo, Flecha, Info, Mas, Menos, NubeLista, NubeSubir } from "./iconos";
import { c, LADO, MARGEN, SALIDA, t } from "./tema";
import { tocar } from "./tocar";

/** Cifras y teclas crecen con la letra del sistema hasta 1,3× (N10). */
export const TOPE_CIFRAS = 1.3;

/** La barra de 9 segmentos solo cabe con ≥ 360 dp y letra ≤ 1,3×; si no, queda el texto (N10). */
export function mostrarSegmentos(ancho: number, escalaLetra: number): boolean {
  return ancho >= 360 && escalaLetra <= TOPE_CIFRAS;
}

const PresionableAnimado = Animated.createAnimatedComponent(Pressable);

/** Todo lo que se toca: se hunde un poco al apoyar el dedo (100 ms) y vuelve al soltar. */
export function Pulsable(
  props: Omit<PressableProps, "style"> & {
    style?: StyleProp<ViewStyle>;
    estiloPresionado?: StyleProp<ViewStyle>;
    escala?: number;
    vibra?: keyof typeof tocar;
    children?: ReactNode;
  },
) {
  const { style, estiloPresionado, escala = 0.97, vibra, onPressIn, onPressOut, onPress, children, ...resto } = props;
  const s = useSharedValue(1);
  const [presionado, setPresionado] = useState(false);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <PresionableAnimado
      {...resto}
      onPressIn={(e) => {
        s.set(withTiming(escala, { duration: 100, easing: SALIDA }));
        setPresionado(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withTiming(1, { duration: 180, easing: SALIDA }));
        setPresionado(false);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (vibra) tocar[vibra]();
        onPress?.(e);
      }}
      pressRetentionOffset={16}
      style={[style, presionado && estiloPresionado, animado]}
    >
      {children}
    </PresionableAnimado>
  );
}

export function BotonPrincipal(props: {
  texto: string;
  alTocar: () => void;
  /** Si falta algo, el botón lo dice en vez de quedar gris y mudo (DESIGN.md). */
  falta?: string;
  testID?: string;
  /** Sin flecha cuando el botón termina algo (guardar, firmar). */
  sinFlecha?: boolean;
}) {
  const deshabilitado = Boolean(props.falta);
  return (
    <Pulsable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={props.alTocar}
      vibra="firme"
      style={[estilos.boton, estilos.botonPrincipal, deshabilitado && estilos.botonDeshabilitado]}
      estiloPresionado={estilos.botonPrincipalPresionado}
    >
      {deshabilitado ? <Info size={20} color={c.suave} weight="bold" /> : null}
      <Text
        maxFontSizeMultiplier={TOPE_CIFRAS}
        style={[estilos.botonTexto, deshabilitado && estilos.textoDeshabilitado]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {props.falta ?? props.texto}
      </Text>
      {deshabilitado || props.sinFlecha ? null : <Flecha size={20} color={c.tinta} weight="bold" />}
    </Pulsable>
  );
}

export function BotonSecundario(props: { texto: string; alTocar: () => void; detalle?: string; testID?: string; icono?: ReactNode }) {
  return (
    <Pulsable
      testID={props.testID}
      accessibilityRole="button"
      onPress={props.alTocar}
      vibra="paso"
      style={[estilos.boton, estilos.botonSecundario]}
      estiloPresionado={estilos.botonSecundarioPresionado}
    >
      {props.icono}
      <View style={estilos.botonSecundarioTextos}>
        <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={estilos.botonSecundarioTexto} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {props.texto}
        </Text>
        {props.detalle ? (
          <Text maxFontSizeMultiplier={TOPE_CIFRAS} style={estilos.botonDetalle} numberOfLines={1}>
            {props.detalle}
          </Text>
        ) : null}
      </View>
    </Pulsable>
  );
}

/** Volver al paso o al miembro anterior: un cuadro con la flecha; el nombre lo lee el lector. */
export function BotonVolver(props: { alTocar: () => void; testID?: string; texto?: string }) {
  return (
    <Pulsable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.texto ?? "Anterior"}
      onPress={props.alTocar}
      vibra="paso"
      style={estilos.volver}
      estiloPresionado={estilos.botonSecundarioPresionado}
      hitSlop={6}
    >
      <Atras size={26} color={c.tinta} weight="bold" />
    </Pulsable>
  );
}

/** El pie de la pantalla con las acciones: siempre a la vista, sobre una raya fina. */
export function Acciones(props: { children: ReactNode; fila?: boolean }) {
  return <View style={[estilos.acciones, props.fila && estilos.accionesFila]}>{props.children}</View>;
}

/** Franja fija: estado de guardado (D5, en calma) y el paso del asistente (D1). */
export function Franja(props: { porSubir: number; paso?: number; totalPasos?: number; titulo?: string }) {
  const { width, fontScale } = useWindowDimensions();
  const total = props.totalPasos ?? 9;
  const guardado = props.porSubir === 0 ? "Nada por subir" : `Guardado en este celular · ${props.porSubir} por subir`;
  const Icono = props.porSubir === 0 ? NubeLista : NubeSubir;
  return (
    <View
      style={estilos.franja}
      accessibilityRole="summary"
      accessible
      accessibilityLabel={props.paso ? `${guardado}. Paso ${props.paso} de ${total}.` : guardado}
    >
      <View style={[estilos.chip, props.porSubir === 0 && estilos.chipListo]}>
        <Icono size={16} color={props.porSubir === 0 ? c.bien : c.suave} weight="bold" />
        <Text style={[estilos.chipTexto, props.porSubir === 0 && { color: c.bien }]} testID="franja-guardado" numberOfLines={2}>
          {guardado}
        </Text>
      </View>
      {props.paso ? (
        <View style={estilos.franjaFila}>
          <Text style={estilos.franjaPaso} testID="franja-paso">
            Paso {props.paso} de {total}
          </Text>
          {mostrarSegmentos(width, fontScale) ? <Segmentos paso={props.paso} total={total} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Segmentos({ paso, total }: { paso: number; total: number }) {
  return (
    <View style={estilos.segmentos} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => (
        <Segmento key={i} estado={i + 1 < paso ? "hecho" : i + 1 === paso ? "actual" : "falta"} />
      ))}
    </View>
  );
}

/** Cada segmento se llena de izquierda a derecha cuando su paso empieza (220 ms). */
function Segmento({ estado }: { estado: "hecho" | "actual" | "falta" }) {
  const lleno = useSharedValue(estado === "falta" ? 0 : 1);
  useEffect(() => {
    lleno.set(withTiming(estado === "falta" ? 0 : 1, { duration: 220, easing: SALIDA }));
  }, [estado, lleno]);
  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: lleno.get() }] }));
  return (
    <View style={estilos.segmento}>
      <Animated.View style={[estilos.segmentoRelleno, { backgroundColor: estado === "actual" ? c.naranja : c.tinta }, relleno]} />
    </View>
  );
}

export function Titulo(props: { children: ReactNode; testID?: string }) {
  return (
    <Text accessibilityRole="header" style={estilos.titulo} testID={props.testID}>
      {props.children}
    </Text>
  );
}

export function Parrafo(props: { children: ReactNode; testID?: string; tenue?: boolean }) {
  return (
    <Text testID={props.testID} style={[estilos.parrafo, props.tenue && { color: c.suave }]}>
      {props.children}
    </Text>
  );
}

/** Rótulo pequeño sobre un grupo (sección de la pantalla). */
export function Rotulo(props: { children: ReactNode }) {
  return <Text style={estilos.rotulo}>{props.children}</Text>;
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

/** El número que cambia da un saltito (crece 12 % y vuelve) para que se note sin leerlo. */
function useSaltito(valor: number) {
  const s = useSharedValue(1);
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    s.set(withSequence(withTiming(1.14, { duration: 70, easing: SALIDA }), withSpring(1, { duration: 260, dampingRatio: 0.7 })));
  }, [valor, s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
}

function Tecla(props: { simbolo: "menos" | "mas"; habilitada: boolean; alTocar: () => void; testID: string; etiqueta: string; grande?: boolean }) {
  const Icono = props.simbolo === "mas" ? Mas : Menos;
  return (
    <Pulsable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.etiqueta}
      accessibilityState={{ disabled: !props.habilitada }}
      disabled={!props.habilitada}
      onPress={props.alTocar}
      vibra="paso"
      escala={0.92}
      style={[estilos.tecla, props.grande && estilos.teclaGrande, props.simbolo === "mas" && estilos.teclaMas, !props.habilitada && estilos.teclaApagada]}
      estiloPresionado={props.simbolo === "mas" ? estilos.teclaMasPresionada : estilos.teclaPresionada}
    >
      <Icono size={props.grande ? 30 : 26} color={props.simbolo === "mas" ? c.papel : c.tinta} weight="bold" />
    </Pulsable>
  );
}

/** Contador − n + con teclas de 56 dp (D11). */
export function Contador(props: {
  etiqueta: string;
  valor: number;
  minimo?: number;
  maximo: number;
  alCambiar: (n: number) => void;
  testID?: string;
  detalle?: string;
}) {
  const minimo = props.minimo ?? 0;
  const { width, fontScale } = useWindowDimensions();
  const apilado = width < 360 || fontScale > 1.15;
  const saltito = useSaltito(props.valor);
  const id = props.testID ?? "contador";
  const valor = (
    <Animated.Text
      testID={`${id}-valor`}
      maxFontSizeMultiplier={TOPE_CIFRAS}
      style={[estilos.contadorValor, saltito]}
      accessibilityLabel={`${props.etiqueta}: ${props.valor}`}
    >
      {props.valor}
    </Animated.Text>
  );
  const teclas = (
    <View style={estilos.filaTeclas}>
      <Tecla simbolo="menos" testID={`${id}-menos`} etiqueta={`Menos ${props.etiqueta}`} habilitada={props.valor > minimo} alTocar={() => props.alCambiar(props.valor - 1)} />
      {valor}
      <Tecla simbolo="mas" testID={`${id}-mas`} etiqueta={`Más ${props.etiqueta}`} habilitada={props.valor < props.maximo} alTocar={() => props.alCambiar(props.valor + 1)} />
    </View>
  );
  return (
    <View style={[estilos.contador, apilado && estilos.contadorApilado]}>
      <View style={{ flex: apilado ? undefined : 1 }}>
        <Text style={estilos.parrafo}>{props.etiqueta}</Text>
        {props.detalle ? <Text style={estilos.contadorDetalle}>{props.detalle}</Text> : null}
      </View>
      {teclas}
    </View>
  );
}

/** Las acciones como sellos de la libreta: cada acción comprada es un cuadro sellado. Se tocan
 * − y + (o un cuadro directo); con más de 10 posibles queda solo el número. */
export function Sellos(props: { valor: number; maximo: number; alCambiar: (n: number) => void; valorUnidad: number; testID?: string }) {
  const id = props.testID ?? "acciones";
  const saltito = useSaltito(props.valor);
  const cuadros = props.maximo <= 10 ? props.maximo : 0;
  return (
    <View style={estilos.sellos}>
      <View style={estilos.sellosFila}>
        <Tecla grande simbolo="menos" testID={`${id}-menos`} etiqueta="Menos acciones" habilitada={props.valor > 0} alTocar={() => props.alCambiar(props.valor - 1)} />
        <View style={estilos.sellosCentro} accessible accessibilityLabel={`${props.valor} ${props.valor === 1 ? "acción" : "acciones"}`}>
          <Animated.Text testID={`${id}-valor`} maxFontSizeMultiplier={TOPE_CIFRAS} style={[estilos.sellosNumero, saltito]}>
            {props.valor}
          </Animated.Text>
          <Text style={estilos.sellosUnidad}>{props.valor === 1 ? "acción" : "acciones"}</Text>
        </View>
        <Tecla grande simbolo="mas" testID={`${id}-mas`} etiqueta="Más acciones" habilitada={props.valor < props.maximo} alTocar={() => props.alCambiar(props.valor + 1)} />
      </View>
      {cuadros ? (
        <View style={estilos.cuadros} importantForAccessibility="no-hide-descendants">
          {Array.from({ length: cuadros }, (_, i) => (
            <Cuadro key={i} lleno={i < props.valor} alTocar={() => props.alCambiar(i + 1 === props.valor ? i : i + 1)} />
          ))}
        </View>
      ) : null}
      <Text style={estilos.sellosPie}>
        {props.valor} × {formatearPesos(props.valorUnidad)} = <Text style={estilos.sellosPieFuerte}>{formatearPesos(props.valor * props.valorUnidad)}</Text>
      </Text>
    </View>
  );
}

/** Un cuadro de la libreta: al sellarse cae de 1,3 a 1 (sin rebote) con la tinta naranja. */
function Cuadro({ lleno, alTocar }: { lleno: boolean; alTocar: () => void }) {
  const s = useSharedValue(lleno ? 1 : 0);
  useEffect(() => {
    s.set(withTiming(lleno ? 1 : 0, { duration: lleno ? 200 : 140, easing: SALIDA }));
  }, [lleno, s]);
  const tinta = useAnimatedStyle(() => ({ opacity: s.get(), transform: [{ scale: 1.3 - 0.3 * s.get() }] }));
  return (
    <Pressable onPress={alTocar} style={estilos.cuadro} hitSlop={4} accessible={false}>
      <Animated.View style={[estilos.cuadroTinta, tinta]}>
        <Chulo size={18} color={c.papel} weight="bold" />
      </Animated.View>
    </Pressable>
  );
}

/** Casilla de un renglón (fondo social premarcado, presente / ausente). */
export function Casilla(props: { texto: string; marcada: boolean; alCambiar: (v: boolean) => void; detalle?: string; testID?: string; numero?: string }) {
  const s = useSharedValue(props.marcada ? 1 : 0);
  useEffect(() => {
    s.set(props.marcada ? withSpring(1, { duration: 280, dampingRatio: 0.65 }) : withTiming(0, { duration: 120 }));
  }, [props.marcada, s]);
  const chulo = useAnimatedStyle(() => ({ opacity: s.get(), transform: [{ scale: 0.6 + 0.4 * s.get() }] }));
  return (
    <Pulsable
      testID={props.testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.marcada }}
      onPress={() => props.alCambiar(!props.marcada)}
      vibra="paso"
      escala={0.985}
      style={[estilos.renglon, props.numero !== undefined && estilos.renglonConNumero]}
      estiloPresionado={estilos.renglonPresionado}
    >
      {props.numero !== undefined ? <Numero texto={props.numero} /> : null}
      <View style={[estilos.caja, props.marcada && estilos.cajaMarcada]}>
        <Animated.View style={chulo}>
          <Chulo size={20} color={c.papel} weight="bold" />
        </Animated.View>
      </View>
      <Text style={[estilos.parrafo, { flex: 1 }, !props.marcada && props.numero !== undefined && estilos.tachado]} numberOfLines={2}>
        {props.texto}
      </Text>
      {props.detalle ? <Text style={[estilos.detalleRenglon, props.marcada && { color: c.tinta }]}>{props.detalle}</Text> : null}
    </Pulsable>
  );
}

/** El número del miembro a la izquierda del margen naranja, como en el cuaderno. */
export function Numero({ texto }: { texto: string }) {
  return (
    <>
      <Text style={estilos.numero} maxFontSizeMultiplier={TOPE_CIFRAS} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {texto}
      </Text>
      <View style={estilos.margen} />
    </>
  );
}

/** Un renglón de la libreta, con o sin número. Si se puede tocar, lleva la flecha. */
export function Renglon(props: { numero?: string; children: ReactNode; derecha?: ReactNode; alTocar?: () => void; testID?: string; deshabilitado?: boolean; accesible?: string }) {
  const contenido = (
    <>
      {props.numero !== undefined ? <Numero texto={props.numero} /> : null}
      <View style={{ flex: 1, gap: 2 }}>{props.children}</View>
      {props.derecha}
    </>
  );
  const estilo = [estilos.renglon, props.numero !== undefined && estilos.renglonConNumero, props.deshabilitado && { opacity: 0.55 }];
  if (!props.alTocar) {
    return (
      <View style={estilo} testID={props.testID}>
        {contenido}
      </View>
    );
  }
  return (
    <Pulsable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.accesible}
      accessibilityState={{ disabled: props.deshabilitado }}
      disabled={props.deshabilitado}
      onPress={props.alTocar}
      vibra="paso"
      escala={0.985}
      style={estilo}
      estiloPresionado={estilos.renglonPresionado}
    >
      {contenido}
    </Pulsable>
  );
}

/** Estado en palabras y color (nunca el color solo). */
export function Etiqueta(props: { tono: "bien" | "aviso" | "mal" | "neutro"; children: ReactNode; testID?: string }) {
  const tonos = {
    bien: [c.bienTinte, c.bien],
    aviso: [c.avisoTinte, c.aviso],
    mal: [c.malTinte, c.mal],
    neutro: [c.hueco, c.suave],
  } as const;
  const [fondo, tinta] = tonos[props.tono];
  return (
    <View style={[estilos.etiquetaEstado, { backgroundColor: fondo }]}>
      <Text testID={props.testID} style={[estilos.etiquetaEstadoTexto, { color: tinta }]}>
        {props.children}
      </Text>
    </View>
  );
}

/** Recuadro para avisos y errores: ícono, color y la frase. */
export function Nota(props: { tono?: "aviso" | "mal" | "bien" | "neutro"; children: ReactNode; testID?: string }) {
  const tono = props.tono ?? "neutro";
  const fondo = { aviso: c.avisoTinte, mal: c.malTinte, bien: c.bienTinte, neutro: c.mesa }[tono];
  const tinta = { aviso: c.aviso, mal: c.mal, bien: c.bien, neutro: c.suave }[tono];
  return (
    <View style={[estilos.nota, { backgroundColor: fondo }]}>
      <Info size={20} color={tinta} weight="bold" />
      <Text testID={props.testID} style={[estilos.notaTexto, { color: tinta }]} accessibilityLiveRegion="polite">
        {props.children}
      </Text>
    </View>
  );
}

/** La planilla de la reunión: los números de todos, como la columna del cuaderno. Los que ya
 * tienen su aporte van en tinta con su chulo; el de ahora, en naranja. Se toca para ir a uno. */
export function Planilla(props: { numeros: number[]; actual: number; anotados: boolean[]; alElegir: (indice: number) => void }) {
  const lista = useRef<ScrollView>(null);
  const ANCHO = 52;
  useEffect(() => {
    lista.current?.scrollTo({ x: Math.max(0, props.actual * (ANCHO + 6) - ANCHO * 2), animated: true });
  }, [props.actual]);
  const hechos = props.anotados.filter(Boolean).length;
  return (
    <View style={estilos.planilla}>
      <Text style={estilos.planillaTitulo} accessibilityRole="text">
        Anotados {hechos} de {props.numeros.length}
      </Text>
      <ScrollView ref={lista} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.planillaFila}>
        {props.numeros.map((n, i) => {
          const actual = i === props.actual;
          const hecho = props.anotados[i];
          return (
            <Pulsable
              key={n}
              testID={`planilla-${n}`}
              accessibilityRole="button"
              accessibilityLabel={`Miembro ${n}${hecho ? ", anotado" : ""}${actual ? ", ahora" : ""}`}
              onPress={() => props.alElegir(i)}
              vibra="paso"
              escala={0.94}
              style={[estilos.planillaCelda, hecho && estilos.planillaHecha, actual && estilos.planillaActual]}
            >
              <Text style={[estilos.planillaNumero, hecho && !actual && { color: c.papel }]} maxFontSizeMultiplier={TOPE_CIFRAS}>
                {String(n).padStart(2, "0")}
              </Text>
              {hecho && !actual ? <Chulo size={12} color={c.naranja} weight="bold" /> : null}
            </Pulsable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** El total con la doble raya del libro de cuentas encima. */
export function Total(props: { pesos: number; etiqueta: string; testID?: string }) {
  return (
    <View style={estilos.total}>
      <View style={estilos.dobleRaya} />
      <Dinero pesos={props.pesos} etiqueta={props.etiqueta} grande testID={props.testID} />
    </View>
  );
}

/** Quién es: el número del cuaderno en su ficha de tinta, el nombre corto y una línea más. */
export function CabezaMiembro(props: { numero: number; nombre?: string | null; detalle?: ReactNode; testID?: string; testIDNombre?: string }) {
  return (
    <View style={estilos.cabezaMiembro}>
      <Text style={estilos.cabezaNumero} testID={props.testID} accessibilityRole="header" maxFontSizeMultiplier={TOPE_CIFRAS}>
        #{String(props.numero).padStart(2, "0")}
      </Text>
      <View style={{ flex: 1 }}>
        {props.nombre ? (
          <Text style={estilos.cabezaNombre} testID={props.testIDNombre} numberOfLines={1}>
            {props.nombre}
          </Text>
        ) : null}
        {props.detalle ? <Text style={estilos.cabezaDetalle}>{props.detalle}</Text> : null}
      </View>
    </View>
  );
}

/** Pantalla de estado (enviar, copia, registro): un ícono grande, el título y lo que pasa. Mientras
 * trabaja, el ícono late despacio (es la única animación continua de la app). */
export function Estado(props: { icono: ReactNode; tono?: "neutro" | "bien" | "aviso" | "mal" | "naranja"; titulo: string; children?: ReactNode; trabajando?: boolean }) {
  const tono = props.tono ?? "naranja";
  const fondo = { neutro: c.hueco, bien: c.bienTinte, aviso: c.avisoTinte, mal: c.malTinte, naranja: c.naranjaTinte }[tono];
  const latido = useSharedValue(1);
  useEffect(() => {
    latido.set(props.trabajando ? withRepeat(withSequence(withTiming(0.55, { duration: 700 }), withTiming(1, { duration: 700 })), -1) : withTiming(1, { duration: 150 }));
  }, [props.trabajando, latido]);
  const late = useAnimatedStyle(() => ({ opacity: latido.get() }));
  return (
    <View style={estilos.estado}>
      <Animated.View style={[estilos.estadoIcono, { backgroundColor: fondo }, late]}>{props.icono}</Animated.View>
      <Text style={estilos.titulo} accessibilityRole="header">
        {props.titulo}
      </Text>
      {props.children}
    </View>
  );
}

/** Campo de texto grande (56 dp) con la etiqueta arriba; al escribir, el borde se pone naranja. */
export function CampoTexto(props: TextInputProps & { etiqueta: string }) {
  const { etiqueta, style, onFocus, onBlur, ...resto } = props;
  const [foco, setFoco] = useState(false);
  return (
    <View style={estilos.campo}>
      <Text style={estilos.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        {...resto}
        accessibilityLabel={resto.accessibilityLabel ?? etiqueta}
        placeholderTextColor={c.tenue}
        onFocus={(e) => {
          setFoco(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          onBlur?.(e);
        }}
        style={[estilos.campoEntrada, foco && estilos.campoFoco, style]}
      />
    </View>
  );
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: c.papel },
  contenido: { paddingHorizontal: LADO, paddingBottom: 28 },
  acciones: {
    paddingHorizontal: LADO,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.renglonFuerte,
    backgroundColor: c.papel,
  },
  accionesFila: { flexDirection: "row", alignItems: "stretch" },
  boton: {
    minHeight: 60,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  botonPrincipal: {
    flex: 1,
    backgroundColor: c.naranja,
    shadowColor: c.naranjaPresionado,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  botonPrincipalPresionado: { backgroundColor: c.naranjaPresionado },
  botonDeshabilitado: { backgroundColor: c.hueco, shadowOpacity: 0, elevation: 0 },
  botonTexto: { ...t["body-fuerte"], fontSize: 19, lineHeight: 24, color: c.tinta, textAlign: "center", flexShrink: 1 },
  textoDeshabilitado: { color: c.suave },
  botonSecundario: { backgroundColor: c.hueco, minHeight: 56 },
  botonSecundarioPresionado: { backgroundColor: c.renglon },
  botonSecundarioTextos: { alignItems: "center", flexShrink: 1 },
  botonSecundarioTexto: { ...t["body-fuerte"], fontSize: 18, color: c.tinta },
  botonDetalle: { ...t.label, fontSize: 15, color: c.suave, marginTop: 2 },
  volver: { width: 60, minHeight: 60, borderRadius: 16, backgroundColor: c.hueco, alignItems: "center", justifyContent: "center" },
  franja: {
    paddingHorizontal: LADO,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: c.papel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.renglonFuerte,
  },
  franjaFila: { flexDirection: "row", alignItems: "center", gap: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 30,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: c.hueco,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  chipListo: { backgroundColor: c.bienTinte },
  chipTexto: { ...t.label, fontSize: 14, color: c.suave, flexShrink: 1 },
  franjaPaso: { ...t.label, fontSize: 15, color: c.tinta },
  segmentos: { flex: 1, flexDirection: "row", gap: 3 },
  segmento: { flex: 1, height: 5, borderRadius: 3, backgroundColor: c.renglon, overflow: "hidden" },
  segmentoRelleno: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 3, transformOrigin: "left" },
  titulo: { ...t["campo-titulo"], color: c.tinta, marginTop: 22, marginBottom: 10 },
  parrafo: { ...t.body, color: c.tinta },
  rotulo: { ...t.label, fontSize: 15, color: c.suave, marginTop: 22, marginBottom: 6 },
  etiqueta: { ...t.label, fontSize: 16, color: c.suave },
  letras: { ...t.body, fontSize: 16, color: c.suave },
  cifraClave: { ...t["cifra-clave"], color: c.tinta },
  cifraRenglon: { ...t["cifra-renglon"], color: c.tinta },
  cifraRenglonPequena: { ...t["cifra-renglon"], fontSize: 18, color: c.tinta },
  renglon: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.renglonFuerte,
    backgroundColor: c.papel,
  },
  renglonConNumero: { marginHorizontal: -LADO, paddingLeft: MARGEN + 14, paddingRight: LADO },
  renglonPresionado: { backgroundColor: c.mesa },
  numero: {
    position: "absolute",
    left: 0,
    width: MARGEN - 12,
    textAlign: "right",
    ...t["cifra-renglon"],
    fontSize: 18,
    color: c.tenue,
  },
  margen: { position: "absolute", left: MARGEN, top: 0, bottom: 0, width: 1.5, backgroundColor: c.margen },
  detalleRenglon: { ...t.label, fontSize: 15, color: c.suave },
  tachado: { color: c.tenue, textDecorationLine: "line-through", textDecorationColor: c.mal },
  contador: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.renglonFuerte,
  },
  contadorApilado: { flexDirection: "column", alignItems: "stretch", gap: 8, paddingVertical: 12 },
  contadorDetalle: { ...t.label, fontSize: 15, color: c.suave, marginTop: 2 },
  contadorValor: { ...t["cifra-renglon"], fontSize: 26, minWidth: 48, textAlign: "center", color: c.tinta },
  filaTeclas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  tecla: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: c.hueco,
    alignItems: "center",
    justifyContent: "center",
  },
  teclaGrande: { width: 68, height: 68, borderRadius: 18 },
  teclaMas: { backgroundColor: c.tinta },
  teclaPresionada: { backgroundColor: c.renglon },
  teclaMasPresionada: { backgroundColor: "#1B3A6B" },
  teclaApagada: { opacity: 0.35 },
  sellos: { paddingVertical: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.renglonFuerte },
  sellosFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sellosCentro: { flex: 1, alignItems: "center" },
  sellosNumero: { ...t["cifra-clave"], fontSize: 52, lineHeight: 56, color: c.tinta },
  sellosUnidad: { ...t.label, fontSize: 16, color: c.suave },
  cuadros: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  cuadro: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: c.renglonFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  cuadroTinta: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: c.naranja,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-4deg" }],
  },
  sellosPie: { ...t.body, fontSize: 16, color: c.suave, textAlign: "center" },
  sellosPieFuerte: { ...t["body-fuerte"], fontSize: 16, color: c.tinta },
  caja: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.renglonFuerte,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.papel,
  },
  cajaMarcada: { backgroundColor: c.tinta, borderColor: c.tinta },
  etiquetaEstado: { paddingHorizontal: 10, minHeight: 28, borderRadius: 8, justifyContent: "center" },
  etiquetaEstadoTexto: { ...t.label, fontSize: 14 },
  nota: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, alignItems: "flex-start" },
  planilla: { paddingTop: 10, paddingBottom: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.renglonFuerte, backgroundColor: c.mesa },
  planillaTitulo: { ...t.label, fontSize: 14, color: c.suave, paddingHorizontal: LADO },
  planillaFila: { paddingHorizontal: LADO, gap: 6 },
  planillaCelda: {
    width: 52,
    height: 48,
    borderRadius: 12,
    backgroundColor: c.papel,
    borderWidth: 1,
    borderColor: c.renglon,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  planillaHecha: { backgroundColor: c.tinta, borderColor: c.tinta },
  planillaActual: { backgroundColor: c.naranjaTinte, borderColor: c.naranja, borderWidth: 2 },
  planillaNumero: { ...t["cifra-renglon"], fontSize: 17, lineHeight: 20, color: c.tinta },
  total: { marginTop: 22, gap: 12 },
  estado: { marginTop: 36, gap: 4 },
  cabezaMiembro: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18, marginBottom: 14 },
  cabezaNumero: {
    ...t["cifra-clave"],
    fontSize: 34,
    lineHeight: 40,
    color: c.papel,
    backgroundColor: c.tinta,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: "hidden",
    minWidth: 78,
    textAlign: "center",
  },
  cabezaNombre: { ...t["campo-subtitulo"], color: c.tinta },
  cabezaDetalle: { ...t.label, fontSize: 15, color: c.suave, marginTop: 2 },
  estadoIcono: { width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  campo: { gap: 8, marginTop: 16 },
  campoEtiqueta: { ...t.label, fontSize: 16, color: c.tinta },
  campoEntrada: {
    ...t.body,
    color: c.tinta,
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: c.renglonFuerte,
    backgroundColor: c.papel,
  },
  campoFoco: { borderColor: c.naranja, backgroundColor: c.naranjaTinte },
  dobleRaya: { height: 5, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: c.tinta },
  notaTexto: { ...t.body, fontSize: 16, lineHeight: 22, flex: 1 },
});
