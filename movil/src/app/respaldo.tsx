// Copia de seguridad (D22, TX7): arma el archivo cifrado con lo que falta subir y lo comparte
// con el menú del sistema (WhatsApp, Bluetooth…). Sin jerga: "Preparando copia…", "¿Llegó?".

import { File, Paths } from "expo-file-system";
import { Redirect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LLAVE_RESPALDO } from "../config";
import { dispositivoRegistrado } from "../enrolamiento/flujo";
import { armarRespaldo, nombreDelArchivo } from "../respaldo/respaldo";
import { firmarComoDispositivo } from "../seguridad/dispositivo";
import { useSesion } from "../sesion/contexto";
import { BotonPrincipal, BotonSecundario, estilos as base, Parrafo, Titulo } from "../ui/componentes";

type Fase = "preparando" | "lista" | "compartida" | "nada" | "error";

export default function PantallaRespaldo() {
  const { sesion, entorno, setSesion } = useSesion();
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("preparando");
  const [archivo, setArchivo] = useState<{ uri: string; elementos: number } | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!sesion) return;
    let vigente = true;
    void (async () => {
      try {
        const ahora = entorno.ahora();
        const { texto, elementos } = await armarRespaldo(entorno.cripto, {
          base: sesion.base,
          dispositivoId: (await dispositivoRegistrado(entorno.almacen)) ?? "",
          llaveServidor: LLAVE_RESPALDO,
          firmarComoDispositivo: (v) => firmarComoDispositivo(entorno.cripto, entorno.almacen, v),
          ahora,
        });
        if (!vigente) return;
        if (elementos === 0) return setFase("nada");
        const destino = new File(Paths.cache, nombreDelArchivo(ahora));
        if (destino.exists) destino.delete();
        destino.create();
        destino.write(texto);
        setArchivo({ uri: destino.uri, elementos });
        setFase("lista");
      } catch (e) {
        if (vigente) {
          setError(e instanceof Error ? e.message : String(e));
          setFase("error");
        }
      }
    })();
    return () => {
      vigente = false;
    };
  }, [sesion, entorno]);

  if (!sesion) return <Redirect href="/" />;
  const salir = () => {
    setSesion(null);
    router.replace("/");
  };
  const compartir = async () => {
    try {
      await Sharing.shareAsync(archivo!.uri, { mimeType: "application/json", dialogTitle: "Enviar copia de seguridad" });
      setFase("compartida");
    } catch {
      setError("No se pudo compartir. Intente de nuevo.");
    }
  };

  return (
    <SafeAreaView style={base.pantalla}>
      <View style={[base.contenido, { flex: 1 }]}>
        <Titulo>Copia de seguridad</Titulo>
        <Parrafo testID="respaldo-estado">
          {fase === "preparando"
            ? "Preparando copia…"
            : fase === "nada"
              ? "Todo está subido. No hace falta copia."
              : fase === "error"
                ? `No se pudo preparar la copia. ${error ?? ""}`
                : fase === "lista"
                  ? `Copia lista con ${archivo!.elementos} registros. Envíela al celular de otro cargo o al facilitador.`
                  : "¿Llegó la copia?"}
        </Parrafo>
        {fase === "lista" ? <Parrafo>Solo la Fundación puede abrirla.</Parrafo> : null}
        {error && fase !== "error" ? <Parrafo>{error}</Parrafo> : null}
      </View>
      <View style={base.acciones}>
        {fase === "lista" ? (
          <BotonPrincipal testID="respaldo-compartir" texto="Enviar copia" alTocar={compartir} />
        ) : fase === "compartida" ? (
          <>
            <BotonPrincipal testID="respaldo-llego" texto="Sí, llegó" alTocar={salir} />
            <BotonSecundario testID="respaldo-reintentar" texto="Reintentar" alTocar={compartir} />
          </>
        ) : (
          <BotonSecundario testID="respaldo-volver" texto="Volver al inicio" alTocar={salir} />
        )}
      </View>
    </SafeAreaView>
  );
}
