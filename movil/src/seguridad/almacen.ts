// Almacén pequeño para secretos y contadores que deben sobrevivir al cierre de la app.
// En el celular es expo-secure-store (cifrado con el Android Keystore); en Jest, memoria.

import * as SecureStore from "expo-secure-store";

export interface AlmacenSeguro {
  leer(clave: string): Promise<string | null>;
  escribir(clave: string, valor: string): Promise<void>;
  borrar(clave: string): Promise<void>;
}

export const almacenDelCelular: AlmacenSeguro = {
  leer: (clave) => SecureStore.getItemAsync(clave),
  escribir: (clave, valor) =>
    SecureStore.setItemAsync(clave, valor, {
      // Solo en este celular y con el equipo desbloqueado una vez; no viaja en copias.
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
  borrar: (clave) => SecureStore.deleteItemAsync(clave),
};

export function almacenEnMemoria(): AlmacenSeguro & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    leer: async (clave) => datos.get(clave) ?? null,
    escribir: async (clave, valor) => {
      datos.set(clave, valor);
    },
    borrar: async (clave) => {
      datos.delete(clave);
    },
  };
}
