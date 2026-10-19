// Vista de solo lectura del socio (TD5: N2, N3, N7, N12). La fecha de los datos primero; nunca
// "saldo" ni "cuenta". Sin capturas de pantalla (FLAG_SECURE) y se cierra al pasar la app a
// segundo plano o tras 60 s sin tocar.

import { formatearPesos } from "@credimpacto/reglas";
import { tokens } from "@credimpacto/tokens";
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
import { BotonPrincipal, BotonSecundario, Dinero, estilos as base, Parrafo } from "../ui/componentes";
import { TecladoPin } from "../ui/TecladoPin";

const { color, spacing, tipo } = tokens;
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
        <Text style={base.cifraRenglon} accessibilityRole="header">
          {quien}
        </Text>
        <BotonSecundario testID="socio-salir" texto="Salir" alTocar={salir} />
      </View>
      <ScrollView contentContainerStyle={base.contenido}>
        {!datos || !vigencia ? (
          <Parrafo>Sus datos se actualizan cuando el celular tenga señal.</Parrafo>
        ) : (
          <>
            <Text style={estilos.fecha} testID="socio-fecha">
              {datos.datos_hasta ? `Datos hasta la reunión del ${fecha(datos.datos_hasta)}` : "Aún no hay reuniones en este ciclo"}
            </Text>
            {vigencia.aviso === "viejos" ? (
              <Text style={estilos.avisoViejo} testID="socio-aviso">
                Estos datos son de hace {vigencia.dias} días. Lleve el celular a señal para actualizarlos.
              </Text>
            ) : null}
            {vigencia.aviso === "caducados" ? (
              <Parrafo testID="socio-caducados">
                Sus datos se actualizan cuando el celular tenga señal. Última actualización: {fecha(datos.actualizado_en)}.
              </Parrafo>
            ) : (
              <>
                <View style={estilos.bloque}>
                  <Dinero testID="socio-ahorrado" pesos={datos.ahorrado_ciclo} etiqueta="Lo que he ahorrado este ciclo" grande />
                </View>
                {datos.prestamo ? (
                  <View style={estilos.bloque}>
                    <Dinero pesos={datos.prestamo.me_falta_pagar} etiqueta="Me falta pagar" />
                    <Text style={base.etiqueta}>Cuota: {formatearPesos(datos.prestamo.cuota)}</Text>
                  </View>
                ) : null}
                <Text style={[base.titulo, { fontSize: 22 }]}>Mis aportes</Text>
                {datos.aportes.length === 0 ? (
                  <Parrafo>Todavía no hay aportes en este ciclo.</Parrafo>
                ) : (
                  datos.aportes.map((a, i) => (
                    <View key={i} style={base.renglon}>
                      <Text style={[base.parrafo, { width: 72 }]}>{fecha(a.fecha)}</Text>
                      <Text style={[base.parrafo, { flex: 1 }]}>{a.acciones} acciones</Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={base.cifraRenglonPequena}>{formatearPesos(a.pesos)}</Text>
                        <Text style={base.etiqueta}>{a.estado === "confirmado" ? "Confirmado" : "Guardado aquí"}</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </>
        )}
        <Text style={estilos.pie}>El dinero lo guarda la caja del grupo.</Text>
      </ScrollView>
      <View style={base.acciones}>
        <BotonPrincipal
          testID="socio-actualizar"
          texto={actualizando ? "Actualizando…" : "Actualizar mis datos"}
          falta={SERVIDOR ? undefined : "Sin servidor configurado"}
          alTocar={async () => {
            setActualizando(true);
            try {
              setDatos(await actualizarSocio(sesion, { cripto: entorno.cripto, servidor: SERVIDOR, ahora: entorno.ahora }));
            } catch {
              setAviso("Necesita señal para actualizar.");
            } finally {
              setActualizando(false);
            }
          }}
        />
        {aviso ? <Parrafo>{aviso}</Parrafo> : null}
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.renglon,
    paddingBottom: spacing.sm,
  },
  fecha: { ...tipo.label, fontSize: 18, color: color["tinta-suave"], marginTop: spacing.lg },
  avisoViejo: {
    ...tipo.body,
    color: color["por-validar"],
    backgroundColor: color["por-validar-tinte"],
    padding: spacing.sm,
    borderRadius: 4,
    marginTop: spacing.sm,
  },
  bloque: { marginTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: color.renglon },
  pie: { ...tipo.label, color: color["tinta-suave"], marginTop: spacing["2xl"] },
});
