// La sesión abierta (base cifrada + quien opera) vive solo en memoria. Las pantallas la reciben
// por contexto; las pruebas la arman con la base en memoria y node:crypto.

import { createContext, useContext, useState, type ReactNode } from "react";

import type { AlmacenSeguro } from "../seguridad/almacen";
import type { Cripto } from "../seguridad/cripto";
import type { AbrirBase, Sesion } from "./abrir";

export interface Entorno {
  cripto: Cripto;
  almacen: AlmacenSeguro;
  abrirBase: AbrirBase;
  ahora: () => Date;
  nuevoId: () => string;
}

interface Valor {
  entorno: Entorno;
  sesion: Sesion | null;
  setSesion: (s: Sesion | null) => void;
}

const Contexto = createContext<Valor | null>(null);

export function ProveedorSesion(props: { entorno: Entorno; sesionInicial?: Sesion; children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(props.sesionInicial ?? null);
  return <Contexto.Provider value={{ entorno: props.entorno, sesion, setSesion }}>{props.children}</Contexto.Provider>;
}

export function useSesion(): Valor {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("Falta ProveedorSesion.");
  return valor;
}
