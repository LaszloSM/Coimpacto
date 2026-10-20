// Comprobantes de la reunión pasada: la junta muestra el QR de cada miembro (pregunta 2b).

import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import type { FotoGrupo } from "../cola/grupo";
import { SERVIDOR } from "../config";
import { Comprobantes } from "../pantallas/Comprobantes";
import { leerFoto } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import { estilos } from "../ui/componentes";

export default function PantallaComprobantes() {
  const { sesion, setSesion } = useSesion();
  const router = useRouter();
  const [foto, setFoto] = useState<FotoGrupo | null | undefined>(undefined);

  useEffect(() => {
    if (sesion) void leerFoto(sesion.base).then(setFoto);
  }, [sesion]);

  if (!sesion) return <Redirect href="/" />;
  if (foto === undefined) return <SafeAreaView style={estilos.pantalla} />;
  return (
    <SafeAreaView style={estilos.pantalla}>
      <Comprobantes
        foto={foto}
        servidor={SERVIDOR}
        alSalir={() => {
          setSesion(null);
          router.replace("/");
        }}
      />
    </SafeAreaView>
  );
}
