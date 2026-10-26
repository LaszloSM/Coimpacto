// Asistente de 9 pasos de la reunión (D1 de diseño). Aquí van los pasos 1 a 4: abrir (una hoja
// nueva del cuaderno), cambios (se salta solo si no hay), asistencia (la lista de la ACAP) y el
// aporte de cada miembro con la planilla arriba (D11). Cada "Guardar y siguiente" guarda y
// también guarda la posición, así una llamada entrante a mitad de la reunión no pierde nada (D14).

import { formatearPesos } from "@credimpacto/reglas";
import { useCallback, useEffect, useState } from "react";
import { Alert, BackHandler, ScrollView, View } from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import type { FotoGrupo, MiembroFoto } from "../cola/grupo";
import { atrasEnAsistente, TEXTO_SALIR } from "../navegacion/atras";
import { leerFoto, type Sesion } from "../sesion/abrir";
import { marcarReunionAbierta, quitarReunionAbierta } from "../sesion/marcas";
import { PasoArqueo, PasoCierre, PasoResumen } from "./PasosCierre";
import { PasoAbonos, PasoPrestamos } from "./PasosPrestamos";
import { PasoCambios } from "./PasoCambios";
import { HojaNueva } from "./piezas";
import { porResponder } from "./propuestas";
import { useSesion } from "../sesion/contexto";
import {
  Acciones,
  BotonPrincipal,
  BotonSecundario,
  BotonVolver,
  CabezaMiembro,
  Casilla,
  Contador,
  estilos as base,
  Franja,
  Nota,
  Parrafo,
  Planilla,
  Rotulo,
  Sellos,
  Titulo,
  Total,
} from "../ui/componentes";
import { SALIDA } from "../ui/tema";
import {
  abrirReunion,
  anotadosDeLaReunion,
  aportesDeLaPasada,
  aportesRegistrados,
  asistencia as leerAsistencia,
  guardarPosicion,
  marcarAsistencia,
  montos,
  MOTIVOS_MULTA,
  PASOS,
  porSubir,
  iguales,
  registrarAportes,
  reunionAbierta,
  siguienteNumero,
  SIN_APORTES,
  type Aportes,
  type ReunionLocal,
} from "./reunion";

const fechaDeHoy = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;


const num = (n: number) => `#${String(n).padStart(2, "0")}`;

interface Estado {
  foto: FotoGrupo | null;
  reunion: ReunionLocal | null;
  porSubir: number;
}

export function Asistente() {
  const { sesion } = useSesion();
  if (!sesion) return null;
  return <AsistenteConSesion sesion={sesion} />;
}

function AsistenteConSesion({ sesion }: { sesion: Sesion }) {
  const { entorno, setSesion } = useSesion();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  // Hacia dónde se mueve la planilla: el miembro siguiente entra por la derecha, el anterior por
  // la izquierda (como pasar renglones del cuaderno).
  const [direccion, setDireccion] = useState<1 | -1>(1);

  const [version, setVersion] = useState(0);
  const recargar = useCallback(async () => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vigente = true;
    void Promise.all([leerFoto(sesion.base), reunionAbierta(sesion.base), porSubir(sesion.base)]).then(
      ([foto, reunion, n]) => {
        if (vigente) setEstado({ foto, reunion, porSubir: n });
      },
    );
    return () => {
      vigente = false;
    };
  }, [sesion, version]);

  // Atrás de Android guiado (N11): paso anterior; en el paso 1 pregunta antes de salir.
  useAtrasDelAsistente(estado, recargar, () => {
    setSesion(null);
    router.replace("/");
  });

  if (!estado) return <SafeAreaView style={base.pantalla} />;
  const paso = estado.reunion?.paso ?? 1;

  const irA = async (siguiente: number, miembro = 0) => {
    if (estado.reunion) {
      setDireccion(siguiente > estado.reunion.paso || (siguiente === estado.reunion.paso && miembro >= estado.reunion.miembro) ? 1 : -1);
      await guardarPosicion(sesion.base, estado.reunion.id, siguiente, miembro);
    }
    await recargar();
  };

  let contenido;
  if (!estado.foto?.ciclo) {
    contenido = <SinLista />;
  } else if (!estado.reunion) {
    contenido = (
      <PasoAbrir
        foto={estado.foto}
        sesion={sesion}
        hoy={entorno.ahora()}
        alAbrir={async () => {
          const ciclo = estado.foto!.ciclo!;
          const reunion = await abrirReunion(sesion.base, sesion.cripto, {
            ciclo,
            numero: await siguienteNumero(sesion.base, estado.foto!, ciclo.id),
            fecha: fechaDeHoy(entorno.ahora()),
            escritor: sesion.firmante,
            id: entorno.nuevoId(),
            ahora: entorno.ahora(),
          });
          await marcarReunionAbierta(entorno.almacen, reunion.fecha);
          // Paso 2 "Cambios desde la última": sin cambios por revisar se salta solo (D7, D8).
          const cambios = await porResponder(sesion.base, estado.foto!);
          await guardarPosicion(sesion.base, reunion.id, cambios.length > 0 ? 2 : 3);
          await recargar();
        }}
      />
    );
  } else if (paso === 2) {
    contenido = <PasoCambios sesion={sesion} foto={estado.foto} alTerminar={() => void irA(3, 0)} />;
  } else if (paso <= 3) {
    contenido = <PasoAsistencia sesion={sesion} foto={estado.foto} reunion={estado.reunion} alSeguir={() => irA(4, 0)} />;
  } else if (paso === 4) {
    contenido = (
      <PasoAportes
        key={estado.reunion.miembro}
        sesion={sesion}
        foto={estado.foto}
        reunion={estado.reunion}
        direccion={direccion}
        alMover={(miembro) => irA(4, miembro)}
        alTerminar={() => irA(5)}
        alVolver={() => irA(3)}
      />
    );
  } else if (paso === 5 || paso === 6) {
    const Paso = paso === 5 ? PasoAbonos : PasoPrestamos;
    contenido = (
      <Paso
        sesion={sesion}
        foto={estado.foto}
        reunion={estado.reunion}
        alSeguir={() => irA(paso + 1)}
        alVolver={() => (paso === 5 ? irA(4, activos(estado.foto!).length - 1) : irA(5))}
        alCambiar={recargar}
      />
    );
  } else if (paso >= 7 && paso <= 9) {
    const comun = {
      sesion,
      foto: estado.foto,
      reunion: estado.reunion,
      alSeguir: () => irA(paso + 1),
      alVolver: () => irA(paso - 1),
      alCambiar: recargar,
    };
    contenido =
      paso === 7 ? (
        <PasoArqueo {...comun} />
      ) : paso === 8 ? (
        <PasoCierre {...comun} />
      ) : (
        <PasoResumen
          {...comun}
          alTerminar={async () => {
            await quitarReunionAbierta(entorno.almacen);
            setSesion(null);
          }}
        />
      );
  } else {
    contenido = <PasoPendiente paso={paso} alVolver={() => irA(paso - 1)} />;
  }

  return (
    <SafeAreaView style={base.pantalla} edges={["top", "bottom"]}>
      <Franja porSubir={estado.porSubir} paso={estado.reunion ? paso : 1} />
      {contenido}
    </SafeAreaView>
  );
}

function useAtrasDelAsistente(estado: Estado | null, recargar: () => void, salir: () => void) {
  const { sesion } = useSesion();
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!estado || !sesion) return false;
      const accion = atrasEnAsistente({
        paso: estado.reunion?.paso ?? 1,
        miembro: estado.reunion?.miembro ?? 0,
        hayReunion: Boolean(estado.reunion),
        ultimoMiembro: Math.max(0, (estado.foto?.miembros.filter((m) => m.activo).length ?? 1) - 1),
      });
      if (accion.tipo === "ir" && estado.reunion) {
        void guardarPosicion(sesion.base, estado.reunion.id, accion.paso, accion.miembro ?? 0).then(recargar);
      } else if (accion.tipo === "confirmar-salir") {
        Alert.alert(TEXTO_SALIR.titulo, TEXTO_SALIR.mensaje, [
          { text: TEXTO_SALIR.no, style: "cancel" },
          { text: TEXTO_SALIR.si, onPress: salir },
        ]);
      }
      return true;
    });
    return () => suscripcion.remove();
  }, [estado, sesion, recargar, salir]);
}

const activos = (foto: FotoGrupo) => foto.miembros.filter((m) => m.activo).sort((a, b) => a.numero - b.numero);

function SinLista() {
  return (
    <View style={base.contenido}>
      <Titulo>Falta la lista del grupo</Titulo>
      <Parrafo>Este celular aún no tiene la lista del grupo. Conéctelo a señal una vez.</Parrafo>
    </View>
  );
}

/** Paso 1: la hoja nueva del cuaderno, con el número de la reunión, la fecha y la ACAP. */
function PasoAbrir(props: { foto: FotoGrupo; sesion: Sesion; hoy: Date; alAbrir: () => Promise<void> }) {
  const [abriendo, setAbriendo] = useState(false);
  const [numero, setNumero] = useState<number | null>(null);
  const ciclo = props.foto.ciclo!;
  useEffect(() => {
    void siguienteNumero(props.sesion.base, props.foto, ciclo.id).then(setNumero);
  }, [props.sesion, props.foto, ciclo.id]);
  const miembros = activos(props.foto).length;
  return (
    <>
      <ScrollView contentContainerStyle={[base.contenido, { flexGrow: 1 }]}>
        <Titulo>{PASOS[0]}</Titulo>
        <HojaNueva
          acap={props.foto.acap.nombre}
          numero={numero}
          hoy={props.hoy}
          ciclo={ciclo.numero}
          valorAccion={ciclo.valor_accion}
          miembros={miembros}
          reuniones={props.foto.reuniones.length}
        />
        <Parrafo tenue>Todo lo de hoy queda guardado en este celular, aunque no haya señal.</Parrafo>
      </ScrollView>
      <Acciones>
        <BotonPrincipal
          testID="abrir-reunion"
          texto={abriendo ? "Abriendo…" : "Abrir la reunión"}
          alTocar={async () => {
            if (abriendo) return;
            setAbriendo(true);
            await props.alAbrir();
          }}
        />
      </Acciones>
    </>
  );
}

/** Paso 3: la lista de la ACAP. Todos empiezan presentes; se toca a quien no vino. */
function PasoAsistencia(props: { sesion: Sesion; foto: FotoGrupo; reunion: ReunionLocal; alSeguir: () => void }) {
  const lista = activos(props.foto);
  const [presentes, setPresentes] = useState<Map<string, boolean> | null>(null);

  useEffect(() => {
    void leerAsistencia(props.sesion.base, props.reunion.id).then(setPresentes);
  }, [props.sesion, props.reunion.id]);

  if (!presentes) return null;
  const esta = (m: MiembroFoto) => presentes.get(m.membresia_id) ?? true;
  const cuantos = lista.filter(esta).length;

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>¿Quién vino hoy?</Titulo>
        <Parrafo tenue>
          Toque a quien no vino. Hoy están {cuantos} de {lista.length}.
        </Parrafo>
        <View style={{ marginTop: 12 }}>
          {lista.map((m) => (
            <Casilla
              key={m.membresia_id}
              testID={`asistencia-${m.numero}`}
              numero={String(m.numero).padStart(2, "0")}
              texto={m.nombre_corto ?? `Miembro ${num(m.numero)}`}
              detalle={esta(m) ? "Vino" : "No vino"}
              marcada={esta(m)}
              alCambiar={async (v) => {
                await marcarAsistencia(props.sesion.base, props.reunion.id, m.membresia_id, v);
                setPresentes(new Map(presentes).set(m.membresia_id, v));
              }}
            />
          ))}
        </View>
      </ScrollView>
      <Acciones>
        <BotonPrincipal
          testID="seguir-aportes"
          texto="Seguir a los aportes"
          alTocar={async () => {
            // Guarda a todos: los que no se tocaron cuentan como presentes.
            for (const m of lista) {
              if (!presentes.has(m.membresia_id)) {
                await marcarAsistencia(props.sesion.base, props.reunion.id, m.membresia_id, true);
              }
            }
            props.alSeguir();
          }}
        />
      </Acciones>
    </>
  );
}

/** Paso 4: el aporte de un miembro, como el renglón del cuaderno pero grande: cuántas acciones
 * compra (sellos), el fondo social, las multas y el total del día. */
function PasoAportes(props: {
  sesion: Sesion;
  foto: FotoGrupo;
  reunion: ReunionLocal;
  direccion: 1 | -1;
  alMover: (miembro: number) => void;
  alTerminar: () => void;
  alVolver: () => void;
}) {
  const { entorno } = useSesion();
  const lista = activos(props.foto);
  const indice = Math.min(props.reunion.miembro, lista.length - 1);
  const miembro = lista[indice];
  const ciclo = props.foto.ciclo!;
  const [aportes, setAportes] = useState<Aportes | null>(null);
  const [pasada, setPasada] = useState<Aportes | null>(null);
  const [anotados, setAnotados] = useState<Map<string, number>>(new Map());
  const [vino, setVino] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      setAnotados(await anotadosDeLaReunion(props.sesion.base, props.reunion.id, ciclo));
      setPasada(await aportesDeLaPasada(props.sesion.base, props.foto, props.reunion.id, miembro.titular_id));
      const presente = (await leerAsistencia(props.sesion.base, props.reunion.id)).get(miembro.membresia_id) ?? true;
      setVino(presente);
      const previo = await aportesRegistrados(props.sesion.base, props.reunion.id, miembro.titular_id);
      if (previo) return setAportes(previo);
      // Quien no vino: sin acciones ni fondo y la multa de inasistencia ya marcada (D11).
      setAportes(presente ? SIN_APORTES : { acciones: 0, fondoSocial: false, multas: { no_asistio: 1 } });
    })();
  }, [props.sesion, props.foto, props.reunion.id, miembro, ciclo]);

  if (!aportes) return null;
  const calculo = montos(ciclo, aportes);
  const cambiar = (parcial: Partial<Aportes>) => setAportes({ ...aportes, ...parcial });
  const numero = num(miembro.numero);
  const ultimo = indice + 1 === lista.length;
  const Entrada = props.direccion === 1 ? FadeInRight : FadeInLeft;

  return (
    <>
      <Planilla
        numeros={lista.map((m) => m.numero)}
        actual={indice}
        anotados={lista.map((m) => anotados.has(m.titular_id))}
        alElegir={(i) => i !== indice && props.alMover(i)}
      />
      <ScrollView contentContainerStyle={base.contenido} keyboardShouldPersistTaps="handled">
        <Animated.View entering={Entrada.duration(200).easing(SALIDA).withInitialValues({ transform: [{ translateX: 28 * props.direccion }] })}>
          <CabezaMiembro
            numero={miembro.numero}
            nombre={miembro.nombre_corto}
            detalle={`${indice + 1} de ${lista.length}${vino ? "" : " · no vino hoy"}`}
            testID="aporte-numero"
            testIDNombre="aporte-nombre"
          />
          {pasada && !iguales(pasada, { ...aportes, multas: {} }) ? (
            // Rellena acciones y fondo; se ve antes de guardar (D11). Las multas quedan como están.
            <View style={{ marginBottom: 6 }}>
              <BotonSecundario
                testID="igual-pasada"
                texto="Igual que la reunión pasada"
                detalle={`${pasada.acciones} ${pasada.acciones === 1 ? "acción" : "acciones"}${pasada.fondoSocial ? " y fondo social" : ""}`}
                alTocar={() => cambiar({ acciones: pasada.acciones, fondoSocial: pasada.fondoSocial })}
              />
            </View>
          ) : null}
          <Rotulo>¿Cuántas acciones compra hoy?</Rotulo>
          <Sellos
            testID="acciones"
            valor={aportes.acciones}
            maximo={ciclo.max_acciones_reunion}
            valorUnidad={ciclo.valor_accion}
            alCambiar={(acciones) => cambiar({ acciones })}
          />
          <Casilla
            testID="fondo-social"
            texto="Fondo social"
            detalle={formatearPesos(ciclo.valor_fondo_social)}
            marcada={aportes.fondoSocial}
            alCambiar={(fondoSocial) => cambiar({ fondoSocial })}
          />
          <Rotulo>Multas</Rotulo>
          {MOTIVOS_MULTA.map((m) => (
            <Contador
              key={m.id}
              testID={`multa-${m.id}`}
              etiqueta={`Multa: ${m.texto}`}
              detalle={formatearPesos(ciclo.valor_multa)}
              valor={aportes.multas[m.id] ?? 0}
              maximo={3}
              alCambiar={(n) => cambiar({ multas: { ...aportes.multas, [m.id]: n } })}
            />
          ))}
          <Total testID="aporte-total" pesos={calculo.total} etiqueta={`Total de ${numero} hoy`} />
        </Animated.View>
      </ScrollView>
      <Acciones fila>
        <BotonVolver testID="aporte-anterior" texto={indice === 0 ? "Volver a la asistencia" : "Miembro anterior"} alTocar={() => (indice === 0 ? props.alVolver() : props.alMover(indice - 1))} />
        <BotonPrincipal
          testID="guardar-siguiente"
          texto={guardando ? "Guardando…" : ultimo ? "Guardar y terminar" : "Guardar y siguiente"}
          alTocar={async () => {
            if (guardando) return;
            setGuardando(true);
            await registrarAportes(props.sesion.base, props.sesion.cripto, {
              reunion: props.reunion,
              ciclo,
              miembro,
              aportes,
              firmante: props.sesion.firmante,
              ahora: entorno.ahora(),
            });
            if (!ultimo) props.alMover(indice + 1);
            else props.alTerminar();
          }}
        />
      </Acciones>
    </>
  );
}

function PasoPendiente(props: { paso: number; alVolver: () => void }) {
  return (
    <>
      <View style={base.contenido}>
        <Titulo>{PASOS[props.paso - 1]}</Titulo>
        <Nota testID="paso-pendiente">
          Este paso todavía no está en esta versión de la app. Lo registrado hasta aquí quedó guardado en este celular.
        </Nota>
      </View>
      <Acciones>
        <BotonSecundario testID="paso-anterior" texto="Volver al paso anterior" alTocar={props.alVolver} />
      </Acciones>
    </>
  );
}
