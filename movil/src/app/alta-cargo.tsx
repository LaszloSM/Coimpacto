// Dar de alta un cargo en este celular (TD1, D18, D26), sin señal: se elige el cargo, el
// Presidente autoriza con su PIN y el cargo nuevo crea el suyo dos veces. La llave sube firmada
// por el Presidente en la próxima sincronización.

import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { FotoGrupo } from "../cola/grupo";
import { altaOtroCargo, dispositivoRegistrado, revisarPinDoble } from "../enrolamiento/flujo";
import { CargoEnPausa, PinFallido } from "../seguridad/intentos";
import { PinIncorrecto } from "../seguridad/llavero";
import { NOMBRE_CARGO, perfiles as leerPerfiles, type Perfil } from "../seguridad/perfiles";
import { leerFoto } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { BotonSecundario, estilos as base, Parrafo, Titulo } from "../ui/componentes";
import { TecladoPin } from "../ui/TecladoPin";

type Fase = "elegir" | "pin-presidente" | "pin-nuevo" | "confirmar" | "guardando" | "listo";

export default function PantallaAltaCargo() {
  const { sesion, entorno, setSesion } = useSesion();
  const router = useRouter();
  const [foto, setFoto] = useState<FotoGrupo | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [fase, setFase] = useState<Fase>("elegir");
  const [cargoId, setCargoId] = useState<string>();
  const [pinPresidente, setPinPresidente] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    if (!sesion) return;
    void Promise.all([leerFoto(sesion.base), leerPerfiles(entorno.almacen)]).then(([f, p]) => {
      setFoto(f);
      setPerfiles(p);
    });
  }, [sesion, entorno]);

  if (!sesion) return <Redirect href="/" />;
  if (!foto) return <SafeAreaView style={base.pantalla} />;
  const presidente = perfiles.find((p) => p.tipo === "presidente");
  const numeroDe = (membresiaId: string) => foto.miembros.find((m) => m.membresia_id === membresiaId)?.numero ?? 0;
  const libres = foto.cargos.filter((c) => !perfiles.some((p) => p.cargoId === c.id));
  const cargo = foto.cargos.find((c) => c.id === cargoId);
  const salir = () => {
    setSesion(null);
    router.replace("/");
  };

  if (fase === "pin-presidente") {
    return (
      <SafeAreaView style={base.pantalla}>
        <TecladoPin
          paraQuien="Presidente"
          aviso={aviso ?? "El Presidente autoriza el alta."}
          alCompletar={(pin) => {
            setPinPresidente(pin);
            setAviso(undefined);
            setFase("pin-nuevo");
          }}
        />
      </SafeAreaView>
    );
  }
  if (fase === "pin-nuevo" || fase === "confirmar" || fase === "guardando") {
    const quien = `${NOMBRE_CARGO[cargo!.tipo] ?? cargo!.tipo} · #${String(numeroDe(cargo!.membresia_id)).padStart(2, "0")}`;
    return (
      <SafeAreaView style={base.pantalla}>
        <TecladoPin
          paraQuien={quien}
          verificando={fase === "guardando"}
          aviso={fase === "pin-nuevo" ? (aviso ?? "Cree su PIN de 6 números.") : "Escriba el PIN otra vez."}
          alCompletar={async (pin) => {
            if (fase === "pin-nuevo") {
              setPinNuevo(pin);
              setAviso(undefined);
              setFase("confirmar");
              return;
            }
            const problema = revisarPinDoble(pinNuevo, pin);
            if (problema) {
              setAviso(problema);
              setFase("pin-nuevo");
              return;
            }
            setFase("guardando");
            try {
              await altaOtroCargo(entorno, {
                base: sesion.base,
                foto,
                presidente: presidente!,
                pinPresidente,
                cargoId: cargo!.id,
                pinNuevo,
                dispositivoId: (await dispositivoRegistrado(entorno.almacen)) ?? "",
              });
              setFase("listo");
            } catch (e) {
              setAviso(
                e instanceof PinFallido || e instanceof PinIncorrecto
                  ? `El PIN del Presidente no coincide. ${e.message}`
                  : e instanceof CargoEnPausa
                    ? "El PIN del Presidente quedó en pausa en este celular."
                    : "No se pudo dar de alta. Intente de nuevo.",
              );
              setFase(e instanceof CargoEnPausa ? "elegir" : "pin-presidente");
            }
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={base.pantalla}>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{fase === "listo" ? "Cargo dado de alta" : "Dar de alta un cargo"}</Titulo>
        {fase === "listo" ? (
          <Parrafo testID="alta-lista">Listo. Ya puede firmar en las reuniones con su PIN.</Parrafo>
        ) : !presidente ? (
          <Parrafo>Primero se registra el Presidente en este celular.</Parrafo>
        ) : libres.length === 0 ? (
          <Parrafo>Todos los cargos del ciclo ya están en este celular.</Parrafo>
        ) : (
          <>
            {aviso ? <Parrafo>{aviso}</Parrafo> : null}
            <Parrafo>¿Qué cargo se registra?</Parrafo>
            {libres.map((c) => (
              <Pressable
                key={c.id}
                testID={`alta-${c.tipo}`}
                accessibilityRole="button"
                onPress={() => {
                  setCargoId(c.id);
                  setAviso(undefined);
                  setFase("pin-presidente");
                }}
                style={base.renglon}
              >
                <Text style={[base.parrafo, { flex: 1 }]}>{NOMBRE_CARGO[c.tipo] ?? c.tipo}</Text>
                <Text style={base.cifraRenglonPequena}>#{String(numeroDe(c.membresia_id)).padStart(2, "0")}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
      <View style={base.acciones}>
        <BotonSecundario testID="alta-volver" texto="Volver al inicio" alTocar={salir} />
      </View>
    </SafeAreaView>
  );
}
