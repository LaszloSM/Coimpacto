// Perfiles de cargo registrados en este celular: el llavero de cada uno (TX3) y lo mínimo para
// mostrarlo en el inicio (cargo y número de miembro; nunca el nombre completo, N1).
// Viven en el Keystore (expo-secure-store), fuera de la base: hacen falta para abrirla.

import type { AlmacenSeguro } from "./almacen";
import type { EntradaCargo } from "./llavero";

export interface Perfil {
  cargoId: string;
  tipo: string;
  numero: number;
}

const INDICE = "perfiles.indice";
const entrada = (cargoId: string) => `llavero.${cargoId}`;

export const NOMBRE_CARGO: Record<string, string> = {
  presidente: "Presidente",
  portador_caja: "Portador de Caja",
  registrador: "Registrador",
  contador_1: "Contador 1",
  contador_2: "Contador 2",
};

export async function perfiles(almacen: AlmacenSeguro): Promise<Perfil[]> {
  const texto = await almacen.leer(INDICE);
  return texto ? (JSON.parse(texto) as Perfil[]) : [];
}

export async function guardarPerfil(almacen: AlmacenSeguro, perfil: Perfil, llavero: EntradaCargo) {
  await almacen.escribir(entrada(perfil.cargoId), JSON.stringify(llavero));
  const lista = (await perfiles(almacen)).filter((p) => p.cargoId !== perfil.cargoId);
  await almacen.escribir(INDICE, JSON.stringify([...lista, perfil]));
}

export async function llaveroDe(almacen: AlmacenSeguro, cargoId: string): Promise<EntradaCargo | null> {
  const texto = await almacen.leer(entrada(cargoId));
  return texto ? (JSON.parse(texto) as EntradaCargo) : null;
}
