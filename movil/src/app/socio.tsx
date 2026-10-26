// Vista de solo lectura del socio (TD5: N2, N3, N7, N12). La fecha de los datos primero; nunca
// "saldo" ni "cuenta". Sin capturas de pantalla (FLAG_SECURE) y se cierra al pasar la app a
// segundo plano o tras 60 s sin tocar.

import { formatearPesos } from "@credimpacto/reglas";
import { usePreventScreenCapture } from "expo-screen-capture";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SERVIDOR } from "../config";
import { abrirBaseSocio } from "../datos/baseNativa";
import { useSesion } from "../sesion/contexto";
import {
  abrirSocio,
  actualizarSocio,
  EsperaSocio,
  leerDatosSocio,
  perfilesSocio,
  PinSocioFallido,
  vigenciaDatos,
  type DatosSocio,
  type PerfilSocio,
  type SesionSocio,
} from "../socio/socio";
import { Acciones, BotonPrincipal, Dinero, estilos as base, Etiqueta, Nota, Parrafo, Pulsable, Renglon, Rotulo } from "../ui/componentes";
import { Chulo, Libreta } from "../ui/iconos";
import { c, LADO, t } from "../ui/tema";
import { TecladoPin } from "../ui/TecladoPin";

const INACTIVIDAD_MS = 60_000;

const fecha = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

export default function PantallaSocio() {
  usePreventScreenCapture();
  const { llave } = useLocalSearchParams<{ llave: string }>();
  const { entorno } = useSesion();
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilSocio>();
  const [sesion, setSesion] = useState<SesionSocio | null>(null);
  const [datos, setDatos] = useState<DatosSocio | null>(null);
  const [aviso, setAviso] = useState<string>();
  const [verificando, setVerificando] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  const salir = useCallback(() => {
    void sesion?.base.cerrar();
    setSesion(null);
    router.replace("/");
  }, [sesion, router]);

  const reiniciarReloj = useCallback(() => {
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = setTimeout(salir, INACTIVIDAD_MS);
  }, [salir]);

  useEffect(() => {
    void perfilesSocio(entorno.almacen).then((lista) => setPerfil(lista.find((p) => p.llaveId === llave)));
  }, [entorno, llave]);

  useEffect(() => {
    if (!sesion) return;
    reiniciarReloj();
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado !== "active") salir();
    });
    return () => {
      suscripcion.remove();
      if (reloj.current) clearTimeout(reloj.current);
    };
  }, [sesion, salir, reiniciarReloj]);

  if (!perfil) return <SafeAreaView style={base.pantalla} />;
  const quien = `#${String(perfil.numero).padStart(2, "0")}`;

  if (!sesion) {
    return (
      <SafeAreaView style={base.pantalla}>
        <TecladoPin
          paraQuien={`Socio ${quien}`}
          aviso={aviso}
          verificando={verificando}
          alCompletar={async (pin) => {
            setVerificando(true);
            try {
              const abierta = await abrirSocio({ ...entorno, abrirBaseSocio }, perfil, pin);
              setSesion(abierta);
              setDatos(await leerDatosSocio(abierta.base));
              setAviso(undefined);
            } catch (e) {
              setAviso(e instanceof EsperaSocio || e instanceof PinSocioFallido ? e.message : "No se pudo abrir. Intente de nuevo.");
            } finally {
              setVerificando(false);
            }
          }}
        />
      </SafeAreaView>
    );
  }

  const vigencia = datos ? vigenciaDatos(datos, entorno.ahora()) : null;
  return (
    <SafeAreaView style={base.pantalla} onTouchStart={reiniciarReloj}>
      <View style={estilos.cabecera}>
        <View style={estilos.cabeceraIzq}>
          <Libreta size={24} color={c.naranja} weight="duotone" />
          <View>
            <Text style={estilos.cabeceraTitulo}>Mi libreta</Text>
            <Text style={estilos.cabeceraNumero} accessibilityRole="header">
              Socio {quien}
            </Text>
          </View>
        </View>
        <Pulsable testID="socio-salir" accessibilityRole="button" onPress={salir} vibra="paso" style={estilos.salir} estiloPresionado={{ backgroundColor: c.renglon }}>
          <Text style={estilos.salirTexto}>Salir</Text>
        </Pulsable>
      </View>
      <ScrollView contentContainerStyle={base.contenido}>
        {!datos || !vigencia ? (
          <View style={{ marginTop: 20 }}>
            <Nota>Sus datos se actualizan cuando el celular tenga señal.</Nota>
          </View>
        ) : (
          <>
            <Text style={estilos.fecha} testID="socio-fecha">
              {datos.datos_hasta ? `Datos hasta la reunión del ${fecha(datos.datos_hasta)}` : "Aún no hay reuniones en este ciclo"}
            </Text>
            {vigencia.aviso === "viejos" ? (
              <Nota tono="aviso" testID="socio-aviso">
                Estos datos son de hace {vigencia.dias} días. Lleve el celular a señal para actualizarlos.
              </Nota>
            ) : null}
            {vigencia.aviso === "caducados" ? (
              <Parrafo testID="socio-caducados">
                Sus datos se actualizan cuando el celular tenga señal. Última actualización: {fecha(datos.actualizado_en)}.
              </Parrafo>
            ) : (
              <>
                <View style={estilos.ahorro}>
                  <Dinero testID="socio-ahorrado" pesos={datos.ahorrado_ciclo} etiqueta="Lo que he ahorrado este ciclo" grande />
                </View>
                {datos.prestamo ? (
                  <View style={estilos.prestamo}>
                    <Dinero pesos={datos.prestamo.me_falta_pagar} etiqueta="Me falta pagar del préstamo" />
                    <Text style={base.detalleRenglon}>Cuota de {formatearPesos(datos.prestamo.cuota)}</Text>
                  </View>
                ) : null}
                <Rotulo>Mis aportes</Rotulo>
                {datos.aportes.length === 0 ? (
                  <Parrafo tenue>Todavía no hay aportes en este ciclo.</Parrafo>
                ) : (
                  datos.aportes.map((a, i) => (
                    <Renglon
                      key={i}
                      numero={fecha(a.fecha)}
                      derecha={
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Text style={base.cifraRenglonPequena}>{formatearPesos(a.pesos)}</Text>
                          <Etiqueta tono={a.estado === "confirmado" ? "bien" : "neutro"}>{a.estado === "confirmado" ? "Confirmado" : "Guardado aquí"}</Etiqueta>
                        </View>
                      }
                    >
                      <View style={estilos.sellos} accessible accessibilityLabel={`${a.acciones} acciones`}>
                        {Array.from({ length: Math.min(a.acciones, 10) }, (_, j) => (
                          <View key={j} style={estilos.sello}>
                            <Chulo size={10} color={c.papel} weight="bold" />
                          </View>
                        ))}
                      </View>
                      <Text style={base.detalleRenglon}>
                        {a.acciones} {a.acciones === 1 ? "acción" : "acciones"}
                      </Text>
                    </Renglon>
                  ))
                )}
              </>
            )}
          </>
        )}
        <Text style={estilos.pie}>El dinero lo guarda la caja del grupo.</Text>
      </ScrollView>
      <Acciones>
        {aviso ? <Nota tono="aviso">{aviso}</Nota> : null}
        <BotonPrincipal
          testID="socio-actualizar"
          texto={actualizando ? "Actualizando…" : "Actualizar mis datos"}
          falta={SERVIDOR ? undefined : "Sin servidor configurado"}
          alTocar={async () => {
            setActualizando(true);
            try {
              setDatos(await actualizarSocio(sesion, { cripto: entorno.cripto, servidor: SERVIDOR, ahora: entorno.ahora }));
              setAviso(undefined);
            } catch {
              setAviso("Necesita señal para actualizar.");
            } finally {
              setActualizando(false);
            }
          }}
        />
      </Acciones>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LADO,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.renglonFuerte,
  },
  cabeceraIzq: { flexDirection: "row", alignItems: "center", gap: 10 },
  cabeceraTitulo: { ...t.label, fontSize: 14, color: c.suave },
  cabeceraNumero: { ...t["campo-subtitulo"], color: c.tinta },
  salir: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: c.hueco, alignItems: "center", justifyContent: "center" },
  salirTexto: { ...t["body-fuerte"], fontSize: 17, color: c.tinta },
  fecha: { ...t.label, fontSize: 16, color: c.suave, marginTop: 20, marginBottom: 10 },
  ahorro: { marginTop: 6, padding: 18, borderRadius: 20, backgroundColor: c.naranjaTinte },
  prestamo: { marginTop: 10, padding: 16, borderRadius: 18, backgroundColor: c.mesa, gap: 4 },
  sellos: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  sello: { width: 18, height: 18, borderRadius: 5, backgroundColor: c.naranja, alignItems: "center", justifyContent: "center" },
  pie: { ...t.label, fontSize: 15, color: c.suave, marginTop: 28, textAlign: "center" },
});
