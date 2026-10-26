// Tema de la app de la reunión: la libreta de la ACAP. Los valores salen de los tokens
// (DESIGN.md); aquí se nombran por su papel en pantalla y se agregan las curvas del movimiento.

import { tokens } from "@credimpacto/tokens";
import { Easing } from "react-native-reanimated";

const { color, tipo } = tokens;

export const c = {
  papel: color.papel,
  mesa: color.mesa,
  tinta: color.tinta,
  suave: color["tinta-suave"],
  tenue: color["tinta-tenue"],
  renglon: color.renglon,
  renglonFuerte: color["renglon-fuerte"],
  hueco: color.hueco,
  naranja: color.naranja,
  naranjaPresionado: color["naranja-presionado"],
  naranjaTinte: color["naranja-tinte"],
  naranjaTexto: color["naranja-texto"],
  /** El margen del cuaderno: naranja suave, para que no compita con el botón. */
  margen: "rgba(246, 106, 3, 0.45)",
  bien: color.confirmado,
  bienTinte: color["confirmado-tinte"],
  mal: color.rechazado,
  malTinte: color["rechazado-tinte"],
  aviso: color["por-validar"],
  avisoTinte: color["por-validar-tinte"],
  azul: color.azul,
  azulTinte: color["azul-tinte"],
};

export const t = tipo;

/** Ancho de la columna del número, a la izquierda del margen (como en el cuaderno). */
export const MARGEN = 60;
export const LADO = 20;

// Curvas (Emil): salida fuerte para entrar/salir, ease-in-out para mover en pantalla.
export const SALIDA = Easing.bezier(0.23, 1, 0.32, 1);
export const MOVER = Easing.bezier(0.77, 0, 0.175, 1);
