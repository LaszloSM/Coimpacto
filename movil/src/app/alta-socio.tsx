// Dar acceso a un socio (N7a): fuera de los 9 pasos, con un cargo. "Voltee el celular hacia
// #07"; el socio escribe su PIN dos veces con el filtro de PIN obvios (D26). Sin capturas.

import { usePreventScreenCapture } from "expo-screen-capture";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { FotoGrupo, MiembroFoto } from "../cola/grupo";
import { abrirBaseSocio } from "../datos/baseNativa";
import { dispositivoRegistrado, revisarPinDoble } from "../enrolamiento/flujo";
import { leerFoto } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { altaSocio, perfilesSocio } from "../socio/socio";
import { BotonSecundario, estilos as base, Parrafo, Titulo } from "../ui/componentes";
import { TecladoPin } from "../ui/TecladoPin";

type Fase = "elegir" | "pin" | "confirmar" | "guardando" | "listo";

export default function PantallaAltaSocio() {
  usePreventScreenCapture();
  const { sesion, entorno, setSesion } = useSesion();
  const router = useRouter();
  const [foto, setFoto] = useState<FotoGrupo | null>(null);
  const [conAcceso, setConAcceso] = useState<string[]>([]);
  const [socio, setSocio] = useState<MiembroFoto | null>(null);
  const [fase, setFase] = useState<Fase>("elegir");
  const [pin, setPin] = useState("");
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    if (!sesion) return;
    void Promise.all([leerFoto(sesion.base), perfilesSocio(entorno.almacen)]).then(([f, s]) => {
      setFoto(f);
      setConAcceso(s.map((p) => p.membresiaId));
    });
  }, [sesion, entorno]);

  if (!sesion) return <Redirect href="/" />;
  if (!foto) return <SafeAreaView style={base.pantalla} />;
  const salir = () => {
    setSesion(null);
    router.replace("/");
  };
  const num = (n: number) => `#${String(n).padStart(2, "0")}`;

  if (socio && (fase === "pin" || fase === "confirmar" || fase === "guardando")) {
    return (
      <SafeAreaView style={base.pantalla}>
        <TecladoPin
          paraQuien={`Voltee el celular hacia ${num(socio.numero)}`}
          verificando={fase === "guardando"}
          aviso={fase === "pin" ? (aviso ?? "Cree su PIN de 6 números.") : "Escriba el PIN otra vez."}
          alCompletar={async (escrito) => {
            if (fase === "pin") {
              setPin(escrito);
              setAviso(undefined);
              setFase("confirmar");
              return;
            }
            const problema = revisarPinDoble(pin, escrito);
            if (problema) {
              setAviso(problema);
              setFase("pin");
              return;
            }
            setFase("guardando");
            try {
              await altaSocio(
                { ...entorno, abrirBaseSocio },
                {
                  base: sesion.base,
                  foto,
                  cargo: sesion.firmante,
                  dispositivoId: (await dispositivoRegistrado(entorno.almacen)) ?? "",
                  membresiaId: socio.membresia_id,
                  pin,
                },
              );
              setFase("listo");
            } catch {
              setAviso("No se pudo dar el acceso. Intente de nuevo.");
              setFase("pin");
            }
          }}
        />
      </SafeAreaView>
    );
  }

  const disponibles = foto.miembros.filter((m) => m.activo && !conAcceso.includes(m.membresia_id));
  return (
    <SafeAreaView style={base.pantalla}>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{fase === "listo" ? "Acceso listo" : "Dar acceso a un socio"}</Titulo>
        {fase === "listo" ? (
          <Parrafo testID="socio-alta-lista">Listo. {num(socio!.numero)} ya puede ver lo suyo en este celular con su PIN.</Parrafo>
        ) : (
          <>
            <Parrafo>¿Qué socio va a ver lo suyo en este celular?</Parrafo>
            {disponibles.map((m) => (
              <Pressable
                key={m.membresia_id}
                testID={`dar-acceso-${m.numero}`}
                accessibilityRole="button"
                onPress={() => {
                  setSocio(m);
                  setAviso(undefined);
                  setFase("pin");
                }}
                style={base.renglon}
              >
                <Text style={base.cifraRenglon}>{num(m.numero)}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
      <View style={base.acciones}>
        <BotonSecundario testID="socio-alta-volver" texto="Volver al inicio" alTocar={salir} />
      </View>
    </SafeAreaView>
  );
}
