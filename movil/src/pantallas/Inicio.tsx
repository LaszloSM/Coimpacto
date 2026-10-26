// Inicio por prioridad (N1, TD1). El único botón naranja es lo que toca ahora: "Seguir la
// reunión del …" si hay una abierta; si no, "Abrir reunión". "Enviar a la Fundación" siempre
// a la vista (N15). Perfiles por número y cargo, nunca nombres completos. Las demás acciones
// van como renglones en "Más opciones", no como una pila de botones. Sin perfiles: el estado
// vacío de registro con "Registrar este celular" (usuario y clave de la ACAP).

import { tokens } from "@credimpacto/tokens";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { NOMBRE_CARGO, type Perfil } from "../seguridad/perfiles";
import { BotonPrincipal, BotonSecundario, estilos as base } from "../ui/componentes";

const { color, tipo, spacing } = tokens;

/** "2026-10-04" → "4 de octubre"; cualquier otro texto queda igual. */
function fechaReunion(texto: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  return new Date(`${texto}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

function Opcion(props: { texto: string; alTocar?: () => void; testID: string }) {
  return (
    <Pressable testID={props.testID} accessibilityRole="button" onPress={props.alTocar} style={base.renglon}>
      <Text style={[base.parrafo, { flex: 1 }]}>{props.texto}</Text>
      <Text style={estilos.flecha} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

export function Inicio(props: {
  error?: string;
  perfiles?: Perfil[];
  elegido?: string;
  /** Fecha de la reunión abierta en este celular, si hay una. */
  reunionAbierta?: string | null;
  alElegir?: (cargoId: string) => void;
  alAbrir?: () => void;
  alEnviar?: () => void;
  alAltaCargo?: () => void;
  alRespaldo?: () => void;
  alComprobantes?: () => void;
  alRegistrar?: () => void;
  /** Socios con acceso en este celular (N1: número, nunca el nombre completo). */
  socios?: { llaveId: string; numero: number }[];
  alVerSocio?: (llaveId: string) => void;
  alAltaSocio?: () => void;
}) {
  const perfiles = props.perfiles ?? [];
  const falta = props.elegido ? undefined : "Elija quién lleva la reunión";
  return (
    <View style={estilos.pagina} testID="inicio">
      <ScrollView contentContainerStyle={estilos.cuerpo}>
        <Text style={estilos.marca} accessibilityRole="header">
          Credimpacto
        </Text>
        <View style={estilos.renglon} />
        {props.error ? (
          <Text style={estilos.mensaje} testID="inicio-error">
            No se pudo preparar este celular. Avise al facilitador. ({props.error})
          </Text>
        ) : perfiles.length === 0 ? (
          <Text style={estilos.mensaje}>Este celular aún no está registrado. Pida a la Fundación el usuario y la clave de su ACAP.</Text>
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
            {props.socios && props.socios.length > 0 ? (
              <>
                <Text style={[estilos.mensaje, { marginTop: spacing.lg }]}>Socios en este celular</Text>
                {props.socios.map((s) => (
                  <Pressable
                    key={s.llaveId}
                    testID={`socio-${s.numero}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver lo mío, socio ${s.numero}`}
                    onPress={() => props.alVerSocio?.(s.llaveId)}
                    style={base.renglon}
                  >
                    <Text style={[base.parrafo, { flex: 1 }]}>Ver lo mío</Text>
                    <Text style={base.cifraRenglonPequena}>#{String(s.numero).padStart(2, "0")}</Text>
                  </Pressable>
                ))}
              </>
            ) : null}
            <Text style={[estilos.mensaje, { marginTop: spacing.lg }]}>Más opciones</Text>
            <Opcion testID="comprobantes" texto="Comprobantes de la reunión pasada" alTocar={props.alComprobantes} />
            <Opcion testID="alta-cargo" texto="Dar de alta un cargo" alTocar={props.alAltaCargo} />
            <Opcion testID="alta-socio" texto="Dar acceso a un socio" alTocar={props.alAltaSocio} />
            <Opcion testID="respaldo" texto="Copia de seguridad" alTocar={props.alRespaldo} />
          </>
        )}
      </ScrollView>
      <View style={base.acciones}>
        {perfiles.length === 0 ? (
          <BotonPrincipal testID="registrar-celular" texto="Registrar este celular" alTocar={() => props.alRegistrar?.()} />
        ) : (
          <>
            <BotonPrincipal
              testID="ir-a-reunion"
              texto={props.reunionAbierta ? `Seguir la reunión del ${fechaReunion(props.reunionAbierta)}` : "Abrir reunión"}
              falta={falta}
              alTocar={() => props.alAbrir?.()}
            />
            <BotonSecundario testID="enviar-fundacion" texto="Enviar a la Fundación" alTocar={() => props.alEnviar?.()} />
          </>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: color.papel },
  cuerpo: { paddingHorizontal: 20, paddingTop: spacing["3xl"] },
  marca: { ...tipo["campo-titulo"], color: color.tinta },
  renglon: { height: 2, backgroundColor: color.renglon, marginVertical: spacing.md },
  mensaje: { ...tipo.body, color: color.tinta, marginBottom: spacing.sm },
  // Cuadrado: el sello es el único elemento redondo del sistema (DESIGN.md, Shapes).
  radio: { width: 28, height: 28, borderRadius: 4, borderWidth: 2, borderColor: color.tinta },
  radioElegido: { borderWidth: 9 },
  flecha: { ...tipo.body, fontSize: 28, color: color["tinta-suave"] },
});
