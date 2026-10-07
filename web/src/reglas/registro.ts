import { pesos, ReglaInvalida } from "./aritmetica";

export interface EntradaRegistro {
  acciones: number;
  cantidad_multas: number;
  valor_accion: number;
  valor_multa: number;
  max_acciones: number;
}

/** Ahorro y multas de una persona en la reunión, desde los precios congelados al abrirla. */
export function montosRegistro(e: EntradaRegistro): { ahorro: number; multas: number } {
  pesos(e.acciones);
  pesos(e.cantidad_multas);
  if (e.acciones > e.max_acciones) {
    throw new ReglaInvalida("MAXIMO_ACCIONES", `${e.acciones} > ${e.max_acciones}`);
  }
  return { ahorro: e.acciones * pesos(e.valor_accion), multas: e.cantidad_multas * pesos(e.valor_multa) };
}
