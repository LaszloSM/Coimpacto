import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { Inicio } from "../pantallas/Inicio";
import { llavesPerdidas } from "../seguridad/dispositivo";
import { tiposCargo, type TipoCargo } from "../seguridad/cargos";
import { perfiles as leerPerfiles, type Perfil } from "../seguridad/perfiles";
import { useSesion } from "../sesion/contexto";
import { reunionAbiertaMarcada } from "../sesion/marcas";
import { perfilesSocio, type PerfilSocio } from "../socio/socio";
import { MODO_PRUEBA, sembrarModoPrueba } from "../sesion/modoPrueba";

export default function PantallaInicio() {
  const { entorno } = useSesion();
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<Perfil[] | null>(null);
  const [elegido, setElegido] = useState<string>();
  const [error, setError] = useState<string>();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [socios, setSocios] = useState<PerfilSocio[]>([]);
  const [tipos, setTipos] = useState<TipoCargo[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        if (MODO_PRUEBA) await sembrarModoPrueba(entorno, entorno.ahora());
        const lista = await leerPerfiles(entorno.almacen);
        if (await llavesPerdidas(entorno.almacen, lista.length > 0)) {
          setError(
            "Este celular perdió sus llaves de seguridad. Lo guardado aquí no se puede abrir: regístrelo de nuevo con el usuario y la clave de la ACAP.",
          );
          setPerfiles([]);
          return;
        }
        setAbierta(await reunionAbiertaMarcada(entorno.almacen));
        setSocios(await perfilesSocio(entorno.almacen));
        setTipos(await tiposCargo(entorno.almacen));
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
      tipos={tipos}
      elegido={elegido}
      alElegir={setElegido}
      reunionAbierta={abierta}
      alAbrir={() => elegido && router.push({ pathname: "/pin", params: { cargo: elegido, accion: "reunion" } })}
      alEnviar={() => elegido && router.push({ pathname: "/pin", params: { cargo: elegido, accion: "enviar" } })}
      alAltaCargo={() => elegido && router.push({ pathname: "/pin", params: { cargo: elegido, accion: "alta" } })}
      alRespaldo={() => elegido && router.push({ pathname: "/pin", params: { cargo: elegido, accion: "respaldo" } })}
      alComprobantes={() => elegido && router.push({ pathname: "/pin", params: { cargo: elegido, accion: "comprobantes" } })}
      alRegistrar={() => router.push("/enrolar")}
      socios={socios}
      alVerSocio={(llave) => router.push({ pathname: "/socio", params: { llave } })}
      alAltaSocio={() => elegido && router.push({ pathname: "/pin", params: { cargo: elegido, accion: "socio" } })}
    />
  );
}
