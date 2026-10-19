// Registrar este celular (TD1, D18): leer el QR del facilitador (o escribir el código), bajar
// la lista del grupo y crear el PIN del primer Presidente, dos veces y sin PIN obvios (D26).
// Textos de la tabla de estados nativos: "Leyendo el código…", "Bajando la lista del grupo…".

import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { tokens } from "@credimpacto/tokens";

import { SERVIDOR } from "../config";
import { borrarBase } from "../datos/baseNativa";
import { altaPrimerPresidente, presidenteDe, registrarCelular, revisarPinDoble, type EnrolamientoEnCurso } from "../enrolamiento/flujo";
import { EnrolamientoFallido } from "../seguridad/enrolamiento";
import { useSesion } from "../sesion/contexto";
import { BotonPrincipal, BotonSecundario, estilos as base, Parrafo, Titulo } from "../ui/componentes";
import { TecladoPin } from "../ui/TecladoPin";

const { color, spacing, tipo, componentes } = tokens;

type Fase = "escanear" | "registrando" | "presidente" | "confirmar" | "guardando" | "listo";

export default function PantallaEnrolar() {
  const { entorno } = useSesion();
  const router = useRouter();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [fase, setFase] = useState<Fase>("escanear");
  const [codigoEscrito, setCodigoEscrito] = useState("");
  const [error, setError] = useState<string>();
  const [enCurso, setEnCurso] = useState<EnrolamientoEnCurso | null>(null);
  const [pin, setPin] = useState("");
  const [leyendo, setLeyendo] = useState(false);

  const deps = { ...entorno, servidor: SERVIDOR, borrarBase };

  const registrar = async (texto: string) => {
    if (leyendo) return;
    setLeyendo(true);
    setError(undefined);
    setFase("registrando");
    try {
      setEnCurso(await registrarCelular(deps, texto));
      setFase("presidente");
    } catch (e) {
      setError(e instanceof EnrolamientoFallido ? e.message : "No se pudo registrar este celular. Intente de nuevo.");
      setFase("escanear");
    } finally {
      setLeyendo(false);
    }
  };

  if (fase === "presidente" || fase === "confirmar" || fase === "guardando") {
    const presidente = enCurso ? presidenteDe(enCurso.foto) : null;
    return (
      <SafeAreaView style={base.pantalla}>
        <TecladoPin
          paraQuien={`Presidente · #${String(presidente?.numero ?? 0).padStart(2, "0")}`}
          aviso={fase === "presidente" ? (error ?? "Cree su PIN de 6 números.") : "Escriba el PIN otra vez."}
          verificando={fase === "guardando"}
          alCompletar={async (escrito) => {
            if (fase === "presidente") {
              setPin(escrito);
              setError(undefined);
              setFase("confirmar");
              return;
            }
            const problema = revisarPinDoble(pin, escrito);
            if (problema) {
              setError(problema);
              setFase("presidente");
              return;
            }
            setFase("guardando");
            try {
              await altaPrimerPresidente(deps, enCurso!, pin);
              await enCurso!.base.cerrar();
              setFase("listo");
            } catch (e) {
              setError(e instanceof EnrolamientoFallido ? e.message : "No se pudo registrar el PIN. Intente de nuevo.");
              setFase(e instanceof EnrolamientoFallido && e.motivo === "codigo_invalido" ? "escanear" : "presidente");
            }
          }}
        />
      </SafeAreaView>
    );
  }

  if (fase === "listo") {
    return (
      <SafeAreaView style={base.pantalla}>
        <View style={[base.contenido, { flex: 1 }]}>
          <Titulo>Celular registrado para {enCurso?.registro.acapNombre}</Titulo>
          <Parrafo>El Presidente ya puede abrir la reunión y dar de alta a los demás cargos.</Parrafo>
        </View>
        <View style={base.acciones}>
          <BotonPrincipal testID="enrolar-listo" texto="Ir al inicio" alTocar={() => router.replace("/")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={base.pantalla}>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>Registrar este celular</Titulo>
        {fase === "registrando" ? (
          <Parrafo testID="enrolar-estado">Bajando la lista del grupo…</Parrafo>
        ) : (
          <>
            <Parrafo>Lea el código que le muestra el facilitador.</Parrafo>
            {error ? (
              <Text style={estilos.error} testID="enrolar-error" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            {!permiso ? null : permiso.granted ? (
              <View style={estilos.camara}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={leyendo ? undefined : ({ data }) => void registrar(data)}
                />
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Parrafo>La app necesita la cámara solo para leer el código.</Parrafo>
                <BotonSecundario
                  testID="permitir-camara"
                  texto={permiso.canAskAgain ? "Permitir la cámara" : "Abrir Ajustes"}
                  alTocar={() => (permiso.canAskAgain ? void pedirPermiso() : void Linking.openSettings())}
                />
              </View>
            )}
            <Text style={[base.titulo, { fontSize: 22 }]}>O escriba el código</Text>
            <TextInput
              testID="codigo-escrito"
              value={codigoEscrito}
              onChangeText={setCodigoEscrito}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Código del facilitador"
              placeholderTextColor={color["tinta-suave"]}
              style={estilos.campo}
              accessibilityLabel="Código del facilitador"
            />
          </>
        )}
      </ScrollView>
      <View style={base.acciones}>
        <BotonPrincipal
          testID="enrolar-codigo"
          texto="Registrar con este código"
          falta={fase === "registrando" ? "Registrando…" : codigoEscrito.trim() ? undefined : "Lea el QR o escriba el código"}
          alTocar={() => {
            const texto = codigoEscrito.trim();
            void registrar(texto.startsWith("credimpacto:") ? texto : `credimpacto:enrolar:${texto}`);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  camara: {
    height: 280,
    borderRadius: componentes.dinero.rounded,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: color.tinta,
    marginVertical: spacing.md,
  },
  campo: {
    ...tipo.body,
    color: color.tinta,
    borderWidth: 2,
    borderColor: componentes.dinero.borderColor,
    borderRadius: componentes.dinero.rounded,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  error: {
    ...tipo.body,
    color: color.rechazado,
    backgroundColor: color["rechazado-tinte"],
    padding: spacing.sm,
    borderRadius: 4,
    marginVertical: spacing.sm,
  },
});
