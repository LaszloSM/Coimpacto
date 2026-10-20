import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { CargoEnPausa, PinFallido } from "../seguridad/intentos";
import { NOMBRE_CARGO, perfiles, type Perfil } from "../seguridad/perfiles";
import { abrirSesion } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { estilos } from "../ui/componentes";
import { TecladoPin } from "../ui/TecladoPin";

export default function PantallaPin() {
  const { cargo } = useLocalSearchParams<{ cargo: string }>();
  const { entorno, setSesion } = useSesion();
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil>();
  const [aviso, setAviso] = useState<string>();
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    void perfiles(entorno.almacen).then((lista) => setPerfil(lista.find((p) => p.cargoId === cargo)));
  }, [entorno, cargo]);

  if (!perfil) return <SafeAreaView style={estilos.pantalla} />;
  return (
    <SafeAreaView style={estilos.pantalla}>
      <TecladoPin
        paraQuien={NOMBRE_CARGO[perfil.tipo] ?? perfil.tipo}
        aviso={aviso}
        verificando={verificando}
        alCompletar={async (pin) => {
          setVerificando(true);
          try {
            setSesion(await abrirSesion(entorno, perfil, pin));
            router.replace("/reunion");
          } catch (error) {
            if (error instanceof PinFallido) setAviso(error.message);
            else if (error instanceof CargoEnPausa) setAviso("Este PIN quedó en pausa en este celular.");
            else setAviso("No se pudo abrir. Intente de nuevo.");
          } finally {
            setVerificando(false);
          }
        }}
      />
    </SafeAreaView>
  );
}
