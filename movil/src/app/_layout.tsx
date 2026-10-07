import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { abrirBase } from "../datos/baseNativa";
import { uuid } from "../seguridad/llavero";
import { almacenDelCelular } from "../seguridad/almacen";
import { criptoNativo } from "../seguridad/criptoNativo";
import { NOMBRE_BASE } from "../sesion/abrir";
import { ProveedorSesion, type Entorno } from "../sesion/contexto";

const entorno: Entorno = {
  cripto: criptoNativo,
  almacen: almacenDelCelular,
  abrirBase: (dek) => abrirBase(NOMBRE_BASE, dek),
  ahora: () => new Date(),
  nuevoId: () => uuid(criptoNativo),
};

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <ProveedorSesion entorno={entorno}>
        {/* Solo modo claro (DESIGN.md): íconos oscuros sobre papel. */}
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </ProveedorSesion>
    </SafeAreaProvider>
  );
}
