// Firmas agrupadas (D10, D13 de diseño): la lista previa de lo que se firma, "Pase el celular
// a…", cada firmante pone su PIN una vez; si un PIN queda en pausa, firma otro cargo válido en
// su reemplazo. Cancelar descarta el grupo entero (N11): nunca firmas a medias.
// Lo usan los préstamos (paso 6) y el cierre (paso 8).

import { useEffect, useState, type ReactNode } from "react";
import { Alert, BackHandler, ScrollView, StyleSheet, Text, View } from "react-native";

import type { FotoGrupo } from "../cola/grupo";
import { CargoEnPausa, PinFallido } from "../seguridad/intentos";
import { nombreCargo, puede, type Permiso } from "../seguridad/cargos";
import { perfiles as leerPerfiles, type Perfil } from "../seguridad/perfiles";
import { useTiposCargo } from "../sesion/useTiposCargo";
import { abrirFirmante } from "../sesion/abrir";
import { TEXTO_CANCELAR_FIRMAS } from "../navegacion/atras";
import { useSesion } from "../sesion/contexto";
import { Acciones, BotonSecundario, estilos as base, Etiqueta, Nota, Renglon, Rotulo, Titulo } from "../ui/componentes";
import { Pluma } from "../ui/iconos";
import { TecladoPin } from "../ui/TecladoPin";
import { c, t } from "../ui/tema";
import { FIRMAS_PRESTAMO, puedeFirmar, type FirmanteCargo, type MotivoFirmaInvalida } from "./prestamos";

const MOTIVO: Record<MotivoFirmaInvalida, string> = {
  mismo_cargo: "ya firmó ese cargo",
  misma_persona: "ya firmó esa persona",
  beneficiario: "pide préstamo hoy",
};

export function FirmasGrupo(props: {
  titulo: string;
  /** Lo que se firma, para leerlo antes (quién, qué, cuánto). */
  lista: ReactNode;
  foto: Pick<FotoGrupo, "miembros">;
  /** Titulares que no pueden firmar (beneficiarios de un préstamo). */
  beneficiarios?: string[];
  alFirmar: (firmantes: FirmanteCargo[]) => Promise<void>;
  alCancelar: () => void;
  /** Permiso del catálogo que necesita cada firmante (por ejemplo, firmar préstamos). */
  permiso?: Permiso;
}) {
  const tipos = useTiposCargo();
  const { entorno } = useSesion();
  const [perfiles, setPerfiles] = useState<Perfil[] | null>(null);
  const [firmantes, setFirmantes] = useState<FirmanteCargo[]>([]);
  const [turno, setTurno] = useState<Perfil | null>(null);
  const [aviso, setAviso] = useState<string>();
  const [verificando, setVerificando] = useState(false);
  const [enPausa, setEnPausa] = useState<string[]>([]);

  useEffect(() => {
    void leerPerfiles(entorno.almacen).then(setPerfiles);
  }, [entorno]);

  // Atrás en un grupo de firmas cancela el grupo entero, nunca firmas a medias (N11).
  const { alCancelar } = props;
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener("hardwareBackPress", () => {
      if (verificando) return true;
      Alert.alert(TEXTO_CANCELAR_FIRMAS.titulo, TEXTO_CANCELAR_FIRMAS.mensaje, [
        { text: TEXTO_CANCELAR_FIRMAS.no, style: "cancel" },
        { text: TEXTO_CANCELAR_FIRMAS.si, style: "destructive", onPress: alCancelar },
      ]);
      return true;
    });
    return () => suscripcion.remove();
  }, [verificando, alCancelar]);
  if (!perfiles) return null;
  const beneficiarios = props.beneficiarios ?? [];

  if (turno) {
    return (
      <TecladoPin
        paraQuien={nombreCargo(tipos, turno.tipo)}
        aviso={aviso}
        verificando={verificando}
        alCompletar={async (pin) => {
          setVerificando(true);
          try {
            const f = await abrirFirmante(entorno, turno, pin);
            const todos = [...firmantes, f];
            if (todos.length >= FIRMAS_PRESTAMO) {
              await props.alFirmar(todos);
              return;
            }
            setFirmantes(todos);
            setTurno(null);
            setAviso(undefined);
          } catch (error) {
            if (error instanceof PinFallido) setAviso(error.message);
            else if (error instanceof CargoEnPausa) {
              setEnPausa([...enPausa, turno.cargoId]);
              setTurno(null);
              setAviso(undefined);
            } else setAviso("No se pudo firmar. Intente de nuevo.");
          } finally {
            setVerificando(false);
          }
        }}
      />
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{props.titulo}</Titulo>
        <View style={estilos.documento}>{props.lista}</View>
        <View style={estilos.rayas} accessible accessibilityLabel={firmantes.length === 0 ? `Faltan ${FIRMAS_PRESTAMO} firmas` : `Falta ${FIRMAS_PRESTAMO - firmantes.length} firma de ${FIRMAS_PRESTAMO}`}>
          {Array.from({ length: FIRMAS_PRESTAMO }, (_, i) => {
            const f = firmantes[i];
            return (
              <View key={i} style={estilos.raya}>
                <View style={estilos.rayaLinea}>
                  {f ? <Pluma size={22} color={c.bien} weight="duotone" /> : null}
                  {f ? <Text style={estilos.rayaFirma}>{nombreCargo(tipos, f.perfil.tipo)}</Text> : null}
                </View>
                <Text style={estilos.rayaPie}>Firma {i + 1}</Text>
              </View>
            );
          })}
        </View>
        <Text style={estilos.faltan} testID="firmas-faltan">
          {firmantes.length === 0 ? `Faltan ${FIRMAS_PRESTAMO} firmas.` : `Falta ${FIRMAS_PRESTAMO - firmantes.length} firma de ${FIRMAS_PRESTAMO}.`}
        </Text>
        {enPausa.length > 0 ? <Nota tono="aviso">Un PIN quedó en pausa en este celular. Firma otro cargo en su reemplazo.</Nota> : null}
        <Rotulo>¿Quién firma?</Rotulo>
        {perfiles.filter((p) => !props.permiso || puede(tipos, p.tipo, props.permiso)).map((p) => {
          const firmo = firmantes.some((f) => f.perfil.cargoId === p.cargoId);
          const motivo = firmo ? null : puedeFirmar(p, firmantes.map((f) => f.perfil), beneficiarios, props.foto);
          const pausado = enPausa.includes(p.cargoId);
          const disponible = !firmo && !motivo && !pausado;
          return (
            <Renglon
              key={p.cargoId}
              testID={`firma-${p.tipo}`}
              deshabilitado={!disponible}
              alTocar={() => setTurno(p)}
              accesible={`Firma ${nombreCargo(tipos, p.tipo)}`}
              derecha={
                <Etiqueta tono={firmo ? "bien" : pausado || motivo ? "aviso" : "neutro"}>
                  {firmo ? "Firmó" : pausado ? "En pausa" : motivo ? `No puede: ${MOTIVO[motivo]}` : "Falta firmar"}
                </Etiqueta>
              }
            >
              <Text style={base.parrafo}>{nombreCargo(tipos, p.tipo)}</Text>
              <Text style={base.detalleRenglon}>#{String(p.numero).padStart(2, "0")}</Text>
            </Renglon>
          );
        })}
      </ScrollView>
      <Acciones>
        <BotonSecundario testID="cancelar-firmas" texto="Cancelar estas firmas" alTocar={props.alCancelar} />
      </Acciones>
    </>
  );
}

const estilos = StyleSheet.create({
  documento: {
    marginTop: 4,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: c.mesa,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.renglonFuerte,
    overflow: "hidden",
  },
  rayas: { flexDirection: "row", gap: 14, marginTop: 22 },
  raya: { flex: 1, gap: 6 },
  rayaLinea: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: c.tinta,
    paddingBottom: 4,
  },
  rayaFirma: { ...t["body-fuerte"], fontSize: 16, color: c.bien, flexShrink: 1 },
  rayaPie: { ...t.label, fontSize: 14, color: c.suave },
  faltan: { ...t["body-fuerte"], color: c.tinta, marginTop: 14, marginBottom: 6 },
});
