// Dar acceso a un socio (N7a): fuera de los 9 pasos, con un cargo. "Voltee el celular hacia
// #07"; el socio escribe su PIN dos veces con el filtro de PIN obvios (D26). Sin capturas.

import { usePreventScreenCapture } from "expo-screen-capture";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { FotoGrupo, MiembroFoto } from "../cola/grupo";
import { abrirBaseSocio } from "../datos/baseNativa";
import { dispositivoRegistrado, revisarPinDoble } from "../enrolamiento/flujo";
import { leerFoto } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { altaSocio, perfilesSocio } from "../socio/socio";
import { Acciones, BotonSecundario, estilos as base, Estado, Nota, Parrafo, Renglon, Titulo } from "../ui/componentes";
import { Ir, Llave } from "../ui/iconos";
import { c } from "../ui/tema";
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
          guia={!(fase === "pin" && aviso)}
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
        {fase === "listo" ? (
          <Estado titulo="Acceso listo" tono="bien" icono={<Llave size={38} color={c.bien} weight="duotone" />}>
            <Parrafo testID="socio-alta-lista">Listo. {num(socio!.numero)} ya puede ver lo suyo en este celular con su PIN.</Parrafo>
          </Estado>
        ) : (
          <>
            <Titulo>Dar acceso a un socio</Titulo>
            {aviso ? <Nota tono="mal">{aviso}</Nota> : null}
            <Parrafo tenue>¿Qué socio va a ver lo suyo en este celular? Solo ve lo de él, con su propio PIN.</Parrafo>
            {disponibles.map((m) => (
              <Renglon
                key={m.membresia_id}
                numero={String(m.numero).padStart(2, "0")}
                testID={`dar-acceso-${m.numero}`}
                accesible={`Dar acceso a ${num(m.numero)}`}
                alTocar={() => {
                  setSocio(m);
                  setAviso(undefined);
                  setFase("pin");
                }}
                derecha={<Ir size={20} color={c.tenue} weight="bold" />}
              >
                <Text style={base.parrafo}>{m.nombre_corto ?? `Miembro ${num(m.numero)}`}</Text>
              </Renglon>
            ))}
          </>
        )}
      </ScrollView>
      <Acciones>
        <BotonSecundario testID="socio-alta-volver" texto="Volver al inicio" alTocar={salir} />
      </Acciones>
    </SafeAreaView>
  );
}
