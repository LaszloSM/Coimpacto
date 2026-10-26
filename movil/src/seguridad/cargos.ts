// Catálogo de cargos que define la Fundación (nombre y permisos). Llega con la foto del grupo y
// se copia al almacén seguro: el inicio lo necesita antes del PIN, cuando la base sigue cerrada.
// Las reglas preguntan por el permiso, nunca por el nombre: un cargo nuevo no pide otra app.

import type { AlmacenSeguro } from "./almacen";

export type Permiso = "autoriza_altas" | "lleva_reunion" | "firma_prestamos" | "firma_cierre";

export interface TipoCargo {
  clave: string;
  nombre: string;
  orden: number;
  autoriza_altas: boolean;
  lleva_reunion: boolean;
  firma_prestamos: boolean;
  firma_cierre: boolean;
}

const CLAVE = "tipos_cargo";

// Cargos de base, para un servidor que todavía no manda el catálogo.
const BASE: TipoCargo[] = [
  ["presidente", "Presidente", true],
  ["portador_caja", "Portador de Caja", false],
  ["registrador", "Registrador", false],
  ["contador_1", "Contador 1", false],
  ["contador_2", "Contador 2", false],
].map(([clave, nombre, autoriza], i) => ({
  clave: clave as string,
  nombre: nombre as string,
  orden: i + 1,
  autoriza_altas: autoriza as boolean,
  lleva_reunion: true,
  firma_prestamos: true,
  firma_cierre: true,
}));

export async function recordarTiposCargo(almacen: AlmacenSeguro, tipos: TipoCargo[] | undefined | null) {
  if (tipos?.length) await almacen.escribir(CLAVE, JSON.stringify(tipos));
}

export async function tiposCargo(almacen: AlmacenSeguro): Promise<TipoCargo[]> {
  const texto = await almacen.leer(CLAVE);
  return texto ? (JSON.parse(texto) as TipoCargo[]) : BASE;
}

const buscar = (tipos: TipoCargo[], clave: string) => tipos.find((t) => t.clave === clave) ?? BASE.find((t) => t.clave === clave);

export function nombreCargo(tipos: TipoCargo[], clave: string): string {
  return buscar(tipos, clave)?.nombre ?? clave;
}

export function puede(tipos: TipoCargo[], clave: string, permiso: Permiso): boolean {
  return buscar(tipos, clave)?.[permiso] ?? false;
}
