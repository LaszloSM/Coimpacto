// expo-updates con el servidor propio (TX9) y expo-network para saber si hay datos móviles (N16).

import * as Network from "expo-network";
import * as Updates from "expo-updates";

import type { Actualizador } from "./actualizar";

export const actualizadorNativo: Actualizador = {
  habilitado: Updates.isEnabled,
  async hayNueva() {
    return (await Updates.checkForUpdateAsync()).isAvailable;
  },
  async bajar() {
    await Updates.fetchUpdateAsync();
  },
  aplicar: () => Updates.reloadAsync(),
};

export async function conDatosMoviles(): Promise<boolean> {
  const estado = await Network.getNetworkStateAsync();
  return estado.type === Network.NetworkStateType.CELLULAR;
}
