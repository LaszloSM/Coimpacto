// Inicio por prioridad (N1, TD1): la portada de la libreta. El único botón naranja es lo que toca
// ahora: "Seguir la reunión del …" si hay una abierta; si no, "Abrir reunión". "Enviar a la
// Fundación" siempre a la vista (N15). Perfiles por número y cargo, nunca nombres completos.
// Las demás acciones van como renglones con su ícono en "Más opciones". Sin perfiles: el estado
// de registro con "Registrar este celular" (usuario y clave de la ACAP).

import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { nombreCargo, puede, type TipoCargo } from "../seguridad/cargos";
import type { Perfil } from "../seguridad/perfiles";
import { Acciones, BotonPrincipal, BotonSecundario, Nota, Pulsable, Renglon, Rotulo, TOPE_CIFRAS } from "../ui/componentes";
import { Archivo, Celular, Chulo, Ir, Libreta, Llave, NubeSubir, Persona, Pluma, Recibo } from "../ui/iconos";
import { c, LADO, t } from "../ui/tema";

/** "2026-10-04" → "4 de octubre"; cualquier otro texto queda igual. */
function fechaReunion(texto: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  return new Date(`${texto}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

function Opcion(props: { texto: string; alTocar?: () => void; testID: string; icono: ReactNode }) {
  return (
    <Renglon testID={props.testID} alTocar={props.alTocar ?? (() => undefined)} accesible={props.texto} derecha={<Ir size={20} color={c.tenue} weight="bold" />}>
      <View style={estilos.opcion}>
        <View style={estilos.opcionIcono}>{props.icono}</View>
        <Text style={estilos.opcionTexto}>{props.texto}</Text>
      </View>
    </Renglon>
  );
}

export function Inicio(props: {
  error?: string;
  perfiles?: Perfil[];
  /** Catálogo de cargos: nombre y quién puede llevar la reunión. */
  tipos?: TipoCargo[];
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
  const tipos = props.tipos ?? [];
  const perfiles = (props.perfiles ?? []).filter((p) => puede(tipos, p.tipo, "lleva_reunion"));
  const falta = props.elegido ? undefined : "Elija quién lleva la reunión";
  const sinRegistro = perfiles.length === 0;
  return (
    <View style={estilos.pagina} testID="inicio">
      <ScrollView contentContainerStyle={estilos.cuerpo}>
        <View style={estilos.marca}>
          <Libreta size={24} color={c.naranja} weight="duotone" />
          <Text style={estilos.marcaTexto} accessibilityRole="header">
            Cred<Text style={{ color: c.naranja }}>i</Text>mpacto
          </Text>
        </View>
        {props.error ? (
          <View style={{ marginTop: 28 }}>
            <Nota tono="mal" testID="inicio-error">
              No se pudo preparar este celular. Avise al facilitador. ({props.error})
            </Nota>
          </View>
        ) : sinRegistro ? (
          <View style={estilos.registro}>
            <View style={estilos.registroIcono}>
              <Celular size={34} color={c.naranja} weight="duotone" />
            </View>
            <Text style={estilos.titulo}>Registre este celular</Text>
            <Text style={estilos.texto}>Este celular aún no está registrado. Pida a la Fundación el usuario y la clave de su ACAP.</Text>
            <Text style={estilos.textoTenue}>Solo se necesita señal para este paso. Después la reunión funciona sin señal.</Text>
          </View>
        ) : (
          <>
            <Text style={estilos.titulo}>¿Quién lleva la reunión?</Text>
            <View style={estilos.fichas} accessibilityRole="radiogroup">
              {perfiles.map((p) => {
                const elegido = p.cargoId === props.elegido;
                return (
                  <Pulsable
                    key={p.cargoId}
                    testID={`perfil-${p.tipo}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: elegido }}
                    accessibilityLabel={`${nombreCargo(tipos, p.tipo)}, número ${p.numero}`}
                    onPress={() => props.alElegir?.(p.cargoId)}
                    vibra="paso"
                    escala={0.98}
                    style={[estilos.ficha, elegido && estilos.fichaElegida]}
                  >
                    <View style={[estilos.fichaIcono, elegido && { backgroundColor: c.naranja }]}>
                      <Pluma size={22} color={elegido ? c.tinta : c.suave} weight="duotone" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={estilos.fichaCargo} numberOfLines={2}>
                        {nombreCargo(tipos, p.tipo)}
                      </Text>
                      <Text style={estilos.fichaNumero} maxFontSizeMultiplier={TOPE_CIFRAS}>
                        #{String(p.numero).padStart(2, "0")}
                      </Text>
                    </View>
                    <View style={[estilos.marcador, elegido && estilos.marcadorElegido]}>{elegido ? <Chulo size={16} color={c.papel} weight="bold" /> : null}</View>
                  </Pulsable>
                );
              })}
            </View>
            {props.socios && props.socios.length > 0 ? (
              <>
                <Rotulo>Socios en este celular</Rotulo>
                {props.socios.map((s) => (
                  <Renglon
                    key={s.llaveId}
                    numero={String(s.numero).padStart(2, "0")}
                    testID={`socio-${s.numero}`}
                    accesible={`Ver lo mío, socio ${s.numero}`}
                    alTocar={() => props.alVerSocio?.(s.llaveId)}
                    derecha={<Ir size={20} color={c.tenue} weight="bold" />}
                  >
                    <Text style={estilos.opcionTexto}>Ver lo mío</Text>
                  </Renglon>
                ))}
              </>
            ) : null}
            <Rotulo>Más opciones</Rotulo>
            <Opcion testID="comprobantes" texto="Comprobantes de la reunión pasada" alTocar={props.alComprobantes} icono={<Recibo size={22} color={c.tinta} weight="duotone" />} />
            <Opcion testID="alta-cargo" texto="Dar de alta un cargo" alTocar={props.alAltaCargo} icono={<Persona size={22} color={c.tinta} weight="duotone" />} />
            <Opcion testID="alta-socio" texto="Dar acceso a un socio" alTocar={props.alAltaSocio} icono={<Llave size={22} color={c.tinta} weight="duotone" />} />
            <Opcion testID="respaldo" texto="Copia de seguridad" alTocar={props.alRespaldo} icono={<Archivo size={22} color={c.tinta} weight="duotone" />} />
          </>
        )}
      </ScrollView>
      <Acciones>
        {sinRegistro ? (
          <BotonPrincipal testID="registrar-celular" texto="Registrar este celular" alTocar={() => props.alRegistrar?.()} />
        ) : (
          <>
            <BotonPrincipal
              testID="ir-a-reunion"
              texto={props.reunionAbierta ? `Seguir la reunión del ${fechaReunion(props.reunionAbierta)}` : "Abrir reunión"}
              falta={falta}
              alTocar={() => props.alAbrir?.()}
            />
            <BotonSecundario testID="enviar-fundacion" texto="Enviar a la Fundación" icono={<NubeSubir size={20} color={c.tinta} weight="bold" />} alTocar={() => props.alEnviar?.()} />
          </>
        )}
      </Acciones>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: c.papel },
  cuerpo: { paddingHorizontal: LADO, paddingTop: 28, paddingBottom: 24 },
  marca: { flexDirection: "row", alignItems: "center", gap: 8 },
  marcaTexto: { ...t["campo-subtitulo"], fontSize: 22, color: c.tinta },
  titulo: { ...t["campo-titulo"], color: c.tinta, marginTop: 30, marginBottom: 14 },
  texto: { ...t.body, color: c.tinta },
  textoTenue: { ...t.body, fontSize: 16, color: c.suave, marginTop: 10 },
  registro: { marginTop: 40 },
  registroIcono: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: c.naranjaTinte,
    alignItems: "center",
    justifyContent: "center",
  },
  fichas: { gap: 10 },
  ficha: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: c.renglon,
    backgroundColor: c.papel,
  },
  fichaElegida: { borderColor: c.naranja, backgroundColor: c.naranjaTinte },
  fichaIcono: { width: 46, height: 46, borderRadius: 14, backgroundColor: c.hueco, alignItems: "center", justifyContent: "center" },
  fichaCargo: { ...t["body-fuerte"], color: c.tinta },
  fichaNumero: { ...t["cifra-renglon"], fontSize: 16, lineHeight: 20, color: c.suave },
  marcador: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: c.renglonFuerte, alignItems: "center", justifyContent: "center" },
  marcadorElegido: { backgroundColor: c.tinta, borderColor: c.tinta },
  opcion: { flexDirection: "row", alignItems: "center", gap: 14 },
  opcionIcono: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.hueco, alignItems: "center", justifyContent: "center" },
  opcionTexto: { ...t.body, color: c.tinta, flex: 1 },
});
