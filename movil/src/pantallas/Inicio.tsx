// Inicio (N1, versión de TX6a): sin perfiles, el estado vacío de enrolamiento; con perfiles,
// quién lleva la reunión y un solo botón naranja. El inicio por prioridad completo llega con TD1.

import { tokens } from "@credimpacto/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NOMBRE_CARGO, type Perfil } from "../seguridad/perfiles";
import { BotonPrincipal, estilos as base } from "../ui/componentes";

const { color, tipo, spacing } = tokens;

export function Inicio(props: {
  error?: string;
  perfiles?: Perfil[];
  elegido?: string;
  alElegir?: (cargoId: string) => void;
  alAbrir?: () => void;
}) {
  const perfiles = props.perfiles ?? [];
  return (
    <View style={estilos.pagina} testID="inicio">
      <View style={estilos.cuerpo}>
        <Text style={estilos.marca} accessibilityRole="header">
          Credimpacto
        </Text>
        <View style={estilos.renglon} />
        {props.error ? (
          <Text style={estilos.mensaje} testID="inicio-error">
            No se pudo preparar este celular. Avise al facilitador. ({props.error})
          </Text>
        ) : perfiles.length === 0 ? (
          <Text style={estilos.mensaje}>Este celular aún no está registrado. Pida el código al facilitador.</Text>
        ) : (
          <>
            <Text style={estilos.mensaje}>¿Quién lleva la reunión?</Text>
            {perfiles.map((p) => {
              const elegido = p.cargoId === props.elegido;
              return (
                <Pressable
                  key={p.cargoId}
                  testID={`perfil-${p.tipo}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: elegido }}
                  onPress={() => props.alElegir?.(p.cargoId)}
                  style={base.renglon}
                >
                  <View style={[estilos.radio, elegido && estilos.radioElegido]} />
                  <Text style={[base.parrafo, { flex: 1 }]}>{NOMBRE_CARGO[p.tipo] ?? p.tipo}</Text>
                  <Text style={base.cifraRenglonPequena}>#{String(p.numero).padStart(2, "0")}</Text>
                </Pressable>
              );
            })}
          </>
        )}
      </View>
      {perfiles.length > 0 ? (
        <View style={base.acciones}>
          <BotonPrincipal
            testID="ir-a-reunion"
            texto="Abrir reunión"
            falta={props.elegido ? undefined : "Elija quién lleva la reunión"}
            alTocar={() => props.alAbrir?.()}
          />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: color.papel },
  cuerpo: { flex: 1, paddingHorizontal: 20, paddingTop: spacing["3xl"] },
  marca: { ...tipo["campo-titulo"], color: color.tinta },
  renglon: { height: 2, backgroundColor: color.renglon, marginVertical: spacing.md },
  mensaje: { ...tipo.body, color: color.tinta, marginBottom: spacing.sm },
  // Cuadrado: el sello es el único elemento redondo del sistema (DESIGN.md, Shapes).
  radio: { width: 28, height: 28, borderRadius: 4, borderWidth: 2, borderColor: color.tinta },
  radioElegido: { borderWidth: 9 },
});
