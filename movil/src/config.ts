// Dirección del servidor de Credimpacto, fija en la app al construirla (EXPO_PUBLIC_SERVIDOR).
// Un QR nunca la cambia (D18): así un código falso no manda el celular a otro servidor.
export const SERVIDOR = (process.env.EXPO_PUBLIC_SERVIDOR ?? "").replace(/\/$/, "");

// Llave pública del servidor para la copia de seguridad (TX7): solo el servidor la abre.
// Se genera con `manage.py generar_llave_respaldo`; la privada vive en el secreto del servidor.
export const LLAVE_RESPALDO = process.env.EXPO_PUBLIC_LLAVE_RESPALDO ?? "";
