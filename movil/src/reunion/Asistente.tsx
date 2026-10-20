// Asistente de 9 pasos de la reunión (D1 de diseño). Esta versión trae los pasos 1 a 4:
// abrir, cambios (se salta solo si no hay), asistencia y aportes por miembro con toques (D11).
// Cada "Guardar y siguiente" guarda y también guarda la posición, así una llamada entrante a
// mitad de la reunión no pierde nada (D14).

import { formatearPesos } from "@credimpacto/reglas";
import { tokens } from "@credimpacto/tokens";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { FotoGrupo, MiembroFoto } from "../cola/grupo";
import { leerFoto, type Sesion } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import {
  BotonPrincipal,
  BotonSecundario,
  Casilla,
  Contador,
  Dinero,
  estilos as base,
  Franja,
  Parrafo,
  Titulo,
} from "../ui/componentes";
import {
  abrirReunion,
  aportesRegistrados,
  asistencia as leerAsistencia,
  guardarPosicion,
  marcarAsistencia,
  montos,
  MOTIVOS_MULTA,
  PASOS,
  porSubir,
  registrarAportes,
  reunionAbierta,
  siguienteNumero,
  SIN_APORTES,
  type Aportes,
  type ReunionLocal,
} from "./reunion";

const { color, spacing, tipo } = tokens;

const fechaDeHoy = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
  const { entorno } = useSesion();
  const [estado, setEstado] = useState<Estado | null>(null);

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

  if (!estado) return <SafeAreaView style={base.pantalla} />;
  const paso = estado.reunion?.paso ?? 1;

  const irA = async (siguiente: number, miembro = 0) => {
    if (estado.reunion) await guardarPosicion(sesion.base, estado.reunion.id, siguiente, miembro);
    await recargar();
  };

  let contenido;
  if (!estado.foto?.ciclo) {
    contenido = <SinLista />;
  } else if (!estado.reunion) {
    contenido = (
      <PasoAbrir
        foto={estado.foto}
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
          // Paso 2 "Cambios desde la última": sin cambios por revisar se salta solo (D7, D8).
          await guardarPosicion(sesion.base, reunion.id, 3);
          await recargar();
        }}
      />
    );
  } else if (paso <= 3) {
    contenido = <PasoAsistencia sesion={sesion} foto={estado.foto} reunion={estado.reunion} alSeguir={() => irA(4, 0)} />;
  } else if (paso === 4) {
    contenido = (
      <PasoAportes
        key={estado.reunion.miembro}
        sesion={sesion}
        foto={estado.foto}
        reunion={estado.reunion}
        alMover={(miembro) => irA(4, miembro)}
        alTerminar={() => irA(5)}
        alVolver={() => irA(3)}
      />
    );
  } else {
    contenido = <PasoPendiente paso={paso} alVolver={() => irA(paso - 1, paso - 1 === 4 ? activos(estado.foto!).length - 1 : 0)} />;
  }

  return (
    <SafeAreaView style={base.pantalla} edges={["top", "bottom"]}>
      <Franja porSubir={estado.porSubir} paso={estado.reunion ? paso : 1} />
      {contenido}
    </SafeAreaView>
  );
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

function PasoAbrir(props: { foto: FotoGrupo; alAbrir: () => Promise<void> }) {
  const [abriendo, setAbriendo] = useState(false);
  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[0]}</Titulo>
        <Parrafo>{props.foto.acap.nombre}</Parrafo>
        <Parrafo>
          {props.foto.reuniones.length === 0
            ? `Primera reunión de ${props.foto.acap.nombre} en Credimpacto.`
            : `Van ${props.foto.reuniones.length} reuniones en este ciclo.`}
        </Parrafo>
      </ScrollView>
      <View style={base.acciones}>
        <BotonPrincipal
          testID="abrir-reunion"
          texto={abriendo ? "Abriendo…" : "Abrir la reunión"}
          alTocar={async () => {
            if (abriendo) return;
            setAbriendo(true);
            await props.alAbrir();
          }}
        />
      </View>
    </>
  );
}

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
        <Titulo>{PASOS[2]}</Titulo>
        <Parrafo>Toque a quien no vino. Hoy están {cuantos} de {lista.length}.</Parrafo>
        {lista.map((m) => (
          <Casilla
            key={m.membresia_id}
            testID={`asistencia-${m.numero}`}
            texto={`#${String(m.numero).padStart(2, "0")}`}
            detalle={esta(m) ? "Vino" : "No vino"}
            marcada={esta(m)}
            alCambiar={async (v) => {
              await marcarAsistencia(props.sesion.base, props.reunion.id, m.membresia_id, v);
              setPresentes(new Map(presentes).set(m.membresia_id, v));
            }}
          />
        ))}
      </ScrollView>
      <View style={base.acciones}>
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
      </View>
    </>
  );
}

function PasoAportes(props: {
  sesion: Sesion;
  foto: FotoGrupo;
  reunion: ReunionLocal;
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
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      const previo = await aportesRegistrados(props.sesion.base, props.reunion.id, miembro.titular_id);
      if (previo) return setAportes(previo);
      const vino = (await leerAsistencia(props.sesion.base, props.reunion.id)).get(miembro.membresia_id) ?? true;
      // Quien no vino: sin acciones ni fondo y la multa de inasistencia ya marcada (D11).
      setAportes(vino ? SIN_APORTES : { acciones: 0, fondoSocial: false, multas: { no_asistio: 1 } });
    })();
  }, [props.sesion, props.reunion.id, miembro]);

  if (!aportes) return null;
  const calculo = montos(ciclo, aportes);
  const cambiar = (parcial: Partial<Aportes>) => setAportes({ ...aportes, ...parcial });
  const numero = `#${String(miembro.numero).padStart(2, "0")}`;

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <View style={estilos.encabezado}>
          <Text style={estilos.numero} testID="aporte-numero" accessibilityRole="header">
            {numero}
          </Text>
          <Text style={estilos.cuenta}>
            {indice + 1}/{lista.length}
          </Text>
        </View>
        <Contador
          testID="acciones"
          etiqueta="Acciones"
          valor={aportes.acciones}
          maximo={ciclo.max_acciones_reunion}
          alCambiar={(acciones) => cambiar({ acciones })}
        />
        <Casilla
          testID="fondo-social"
          texto="Fondo social"
          detalle={formatearPesos(ciclo.valor_fondo_social)}
          marcada={aportes.fondoSocial}
          alCambiar={(fondoSocial) => cambiar({ fondoSocial })}
        />
        {MOTIVOS_MULTA.map((m) => (
          <Contador
            key={m.id}
            testID={`multa-${m.id}`}
            etiqueta={`Multa: ${m.texto}`}
            valor={aportes.multas[m.id] ?? 0}
            maximo={3}
            alCambiar={(n) => cambiar({ multas: { ...aportes.multas, [m.id]: n } })}
          />
        ))}
        <View style={estilos.total}>
          <Dinero testID="aporte-total" pesos={calculo.total} etiqueta={`Total de ${numero} hoy`} grande />
        </View>
      </ScrollView>
      <View style={[base.acciones, estilos.dosBotones]}>
        <View style={{ flex: 1 }}>
          <BotonSecundario
            testID="aporte-anterior"
            texto="Anterior"
            alTocar={() => (indice === 0 ? props.alVolver() : props.alMover(indice - 1))}
          />
        </View>
        <View style={{ flex: 2 }}>
          <BotonPrincipal
            testID="guardar-siguiente"
            texto={guardando ? "Guardando…" : "Guardar y siguiente"}
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
              if (indice + 1 < lista.length) props.alMover(indice + 1);
              else props.alTerminar();
            }}
          />
        </View>
      </View>
    </>
  );
}

function PasoPendiente(props: { paso: number; alVolver: () => void }) {
  return (
    <>
      <View style={base.contenido}>
        <Titulo>{PASOS[props.paso - 1]}</Titulo>
        <Parrafo testID="paso-pendiente">
          Este paso todavía no está en esta versión de la app. Lo registrado hasta aquí quedó guardado en este
          celular.
        </Parrafo>
      </View>
      <View style={base.acciones}>
        <BotonSecundario testID="paso-anterior" texto="Volver al paso anterior" alTocar={props.alVolver} />
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  encabezado: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: spacing.lg },
  numero: { ...tipo["cifra-clave"], color: color.tinta },
  cuenta: { ...tipo["cifra-renglon"], color: color["tinta-suave"] },
  total: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 3, borderTopColor: color.tinta },
  dosBotones: { flexDirection: "row", gap: spacing.sm },
});
