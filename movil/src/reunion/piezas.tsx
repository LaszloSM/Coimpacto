// Piezas visuales del asistente, sin datos: la hoja nueva del cuaderno con la que se abre la
// reunión (número, fecha, ACAP y ciclo).

import { formatearPesos } from "@credimpacto/reglas";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Calendario, Libreta } from "../ui/iconos";
import { c, MARGEN, t } from "../ui/tema";

const fechaLarga = (d: Date) => d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

export function HojaNueva(props: { acap: string; numero: number | null; hoy: Date; ciclo: number; valorAccion: number; miembros: number; reuniones: number }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={estilos.hoja}>
      <View style={estilos.hojaMargen} />
      <View style={estilos.hojaCabeza}>
        <Libreta size={22} color={c.naranja} weight="duotone" />
        <Text style={estilos.hojaAcap} numberOfLines={2}>
          {props.acap}
        </Text>
      </View>
      <Text style={estilos.hojaNumero}>Reunión {props.numero ?? "…"}</Text>
      <View style={estilos.hojaFecha}>
        <Calendario size={18} color={c.suave} weight="bold" />
        <Text style={estilos.hojaFechaTexto}>{fechaLarga(props.hoy)}</Text>
      </View>
      <View style={estilos.hojaRenglones}>
        <Text style={estilos.hojaDato}>
          Ciclo {props.ciclo} · acción de <Text style={estilos.hojaDatoFuerte}>{formatearPesos(props.valorAccion)}</Text>
        </Text>
        <Text style={estilos.hojaDato}>
          {props.miembros} {props.miembros === 1 ? "miembro activo" : "miembros activos"}
        </Text>
        <Text style={estilos.hojaDato}>
          {props.reuniones === 0
            ? `Primera reunión de ${props.acap} en Credimpacto.`
            : `Van ${props.reuniones} reuniones en este ciclo.`}
        </Text>
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  hoja: {
    marginTop: 4,
    marginBottom: 18,
    marginHorizontal: -6,
    paddingVertical: 22,
    paddingRight: 18,
    paddingLeft: MARGEN - 2,
    borderRadius: 16,
    backgroundColor: "#FFFEFB",
    borderWidth: 1,
    borderColor: c.renglon,
    shadowColor: c.tinta,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    gap: 14,
    overflow: "hidden",
  },
  hojaMargen: { position: "absolute", left: MARGEN - 18, top: 0, bottom: 0, width: 1.5, backgroundColor: c.margen },
  hojaCabeza: { flexDirection: "row", alignItems: "center", gap: 10 },
  hojaAcap: { ...t["campo-subtitulo"], color: c.tinta, flex: 1 },
  hojaNumero: { ...t["cifra-clave"], fontSize: 40, lineHeight: 44, color: c.tinta },
  hojaFecha: { flexDirection: "row", alignItems: "center", gap: 8 },
  hojaFechaTexto: { ...t["body-fuerte"], fontSize: 17, color: c.suave },
  hojaRenglones: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.renglonFuerte },
  hojaDato: {
    ...t.body,
    fontSize: 17,
    color: c.suave,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.renglonFuerte,
  },
  hojaDatoFuerte: { ...t["body-fuerte"], fontSize: 17, color: c.tinta },
});
