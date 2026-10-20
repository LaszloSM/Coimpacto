import { Redirect } from "expo-router";

import { Asistente } from "../reunion/Asistente";
import { useSesion } from "../sesion/contexto";

export default function PantallaReunion() {
  const { sesion } = useSesion();
  // Sin sesión abierta (la app se reinició): vuelve al inicio a pedir el PIN (D14).
  if (!sesion) return <Redirect href="/" />;
  return <Asistente />;
}
