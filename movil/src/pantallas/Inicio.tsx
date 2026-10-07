import { tokens } from "@credimpacto/tokens";
import { StyleSheet, Text, View } from "react-native";

const { color, tipo, spacing } = tokens;

// Esqueleto de TX2: el estado vacío de enrolamiento (N1, tabla de estados). El inicio por
// prioridad (reunión abierta, para revisar, perfiles) llega con TD1.
export function Inicio() {
  return (
    <View style={estilos.pagina} testID="inicio">
      <Text style={estilos.marca} accessibilityRole="header">
        Credimpacto
      </Text>
      <View style={estilos.renglon} />
      <Text style={estilos.mensaje}>
        Este celular aún no está registrado. Pida el código al facilitador.
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: {
    flex: 1,
    backgroundColor: color.papel,
    paddingHorizontal: spacing.md,
    paddingTop: spacing["3xl"],
  },
  marca: { ...tipo["campo-titulo"], color: color.tinta },
  renglon: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: color.renglon,
    marginVertical: spacing.md,
  },
  mensaje: { ...tipo.body, color: color.tinta },
});
