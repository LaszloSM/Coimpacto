// Enviar a la Fundación (N15, TX5/TX6.0): sube la cola y baja el grupo, en primer plano y con
// textos de la tabla de estados ("Se cortó la señal. Seguirá donde quedó."). Un celular
// retirado sube lo suyo y después borra sus datos (E3).

import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { enviarPorHttp } from "../cola/cola";
import { bajarPorHttp, sincronizarTodo, type ResultadoSincronizacion } from "../cola/grupo";
import { SERVIDOR } from "../config";
import { borrarBase } from "../datos/baseNativa";
import { dispositivoRegistrado } from "../enrolamiento/flujo";
import { firmarComoDispositivo } from "../seguridad/dispositivo";
import { useSesion } from "../sesion/contexto";
import { BotonPrincipal, estilos as base, Franja, Parrafo, Titulo } from "../ui/componentes";

export default function PantallaEnviar() {
  const { sesion, entorno, setSesion } = useSesion();
  const router = useRouter();
  const [resultado, setResultado] = useState<ResultadoSincronizacion | { fin: "error"; mensaje: string } | null>(null);

  useEffect(() => {
    if (!sesion) return;
    let vigente = true;
    void (async () => {
      try {
        const dispositivoId = await dispositivoRegistrado(entorno.almacen);
        if (!SERVIDOR || !dispositivoId) throw new Error("Este celular no tiene servidor ni registro.");
        const firmarCuerpo = (v: Parameters<typeof firmarComoDispositivo>[2]) => firmarComoDispositivo(entorno.cripto, entorno.almacen, v);
        const r = await sincronizarTodo(sesion.base, {
          enviar: enviarPorHttp({ servidor: SERVIDOR, dispositivoId, firmarCuerpo }),
          bajar: bajarPorHttp({ servidor: SERVIDOR, dispositivoId, firmarComoDispositivo: firmarCuerpo }),
          nuevoId: entorno.nuevoId,
          ahora: entorno.ahora,
        });
        if (r.fin === "retirado") {
          await sesion.base.cerrar();
          await borrarBase();
        }
        if (vigente) setResultado(r);
      } catch (e) {
        if (vigente) setResultado({ fin: "error", mensaje: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      vigente = false;
    };
  }, [sesion, entorno]);

  if (!sesion) return <Redirect href="/" />;

  const texto = !resultado
    ? "Enviando a la Fundación…"
    : resultado.fin === "listo"
      ? `Todo subido. Confirmados: ${resultado.subida.porEstado.confirmado}. ${
          resultado.subida.porEstado.rechazado + resultado.subida.porEstado.en_conflicto > 0
            ? `Hay ${resultado.subida.porEstado.rechazado + resultado.subida.porEstado.en_conflicto} para revisar con el facilitador.`
            : ""
        }`
      : resultado.fin === "sin_senal"
        ? "Se cortó la señal. Seguirá donde quedó."
        : resultado.fin === "retirado"
          ? "La Fundación retiró este celular. Se envió lo guardado y se borraron sus datos."
          : `No se pudo enviar. ${resultado.mensaje}`;

  return (
    <SafeAreaView style={base.pantalla}>
      <Franja porSubir={0} />
      <View style={[base.contenido, { flex: 1 }]}>
        <Titulo>Enviar a la Fundación</Titulo>
        <Parrafo testID="envio-estado">{texto}</Parrafo>
      </View>
      <View style={base.acciones}>
        <BotonPrincipal
          testID="envio-volver"
          texto="Volver al inicio"
          falta={resultado ? undefined : "Enviando…"}
          alTocar={() => {
            setSesion(null);
            router.replace("/");
          }}
        />
      </View>
    </SafeAreaView>
  );
}
