// Dirección del servidor de Credimpacto, fija en la app al construirla (EXPO_PUBLIC_SERVIDOR).
// Un QR nunca la cambia (D18): así un código falso no manda el celular a otro servidor.
export const SERVIDOR = (process.env.EXPO_PUBLIC_SERVIDOR ?? "").replace(/\/$/, "");
