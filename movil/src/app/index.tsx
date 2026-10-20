import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { Inicio } from "../pantallas/Inicio";
import { perfiles as leerPerfiles, type Perfil } from "../seguridad/perfiles";
import { useSesion } from "../sesion/contexto";
import { MODO_PRUEBA, sembrarModoPrueba } from "../sesion/modoPrueba";

export default function PantallaInicio() {
  const { entorno } = useSesion();
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<Perfil[] | null>(null);
  const [elegido, setElegido] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void (async () => {
      try {
        if (MODO_PRUEBA) await sembrarModoPrueba(entorno, entorno.ahora());
        const lista = await leerPerfiles(entorno.almacen);
        setPerfiles(lista);
        if (lista.length === 1) setElegido(lista[0].cargoId);
      } catch (e) {
        // Nunca una pantalla en blanco: se dice qué pasó (y queda en el registro del celular).
        console.error("Credimpacto: no se pudo preparar el celular", e);
        setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        setPerfiles([]);
      }
    })();
  }, [entorno]);

  if (!perfiles) return null;
  return (
    <Inicio
      error={error}
      perfiles={perfiles}
      elegido={elegido}
      alElegir={setElegido}
      alAbrir={() => elegido && router.push({ pathname: "/pin", params: { cargo: elegido } })}
    />
  );
}
