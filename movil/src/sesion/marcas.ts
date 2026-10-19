// Marcas pequeñas fuera de la base cifrada para el inicio por prioridad (N1): el inicio decide
// el botón naranja antes de pedir el PIN, sin abrir la base. Solo la fecha, ningún dato del grupo.

import type { AlmacenSeguro } from "../seguridad/almacen";

const REUNION_ABIERTA = "reunion.abierta";

export const marcarReunionAbierta = (almacen: AlmacenSeguro, fecha: string) => almacen.escribir(REUNION_ABIERTA, fecha);
export const quitarReunionAbierta = (almacen: AlmacenSeguro) => almacen.borrar(REUNION_ABIERTA);
export const reunionAbiertaMarcada = (almacen: AlmacenSeguro) => almacen.leer(REUNION_ABIERTA);
