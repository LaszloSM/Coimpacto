// Pasos 7 (arqueo), 8 (cierre y firmas) y 9 (resumen por miembro) del asistente (TX6c).
// Arqueo a ciegas por denominación con el color real de cada billete; lo esperado se revela
// al tocar "Terminé de contar" (D12). El cierre ratifica las correcciones de hoy (D9) y se
// firma en grupo; al firmar cae el sello «Bien contado» (DESIGN.md, el momento de la marca).

import { formatearPesos } from "@credimpacto/reglas";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import type { Elemento } from "../cola/cola";
import type { FotoGrupo } from "../cola/grupo";
import type { Sesion } from "../sesion/abrir";
import { useSesion } from "../sesion/contexto";
import {
  Acciones,
  BotonPrincipal,
  BotonSecundario,
  BotonVolver,
  CabezaMiembro,
  Dinero,
  estilos as base,
  Nota,
  Parrafo,
  Renglon,
  Rotulo,
  Titulo,
  Total,
} from "../ui/componentes";
import { Calendario, Listo } from "../ui/iconos";
import { c, t } from "../ui/tema";
import { tocar } from "../ui/tocar";
import {
  arqueoGuardado,
  BILLETES,
  cerrarReunion,
  correccionesDeHoy,
  esperadoEnCaja,
  guardarConteo,
  guardarMotivo,
  MONEDAS,
  resumenMiembro,
  terminarReunion,
  totalConteo,
  type Arqueo,
  type Conteo,
  type ResumenMiembro,
} from "./cierre";
import { programadorNativo } from "../avisos/programadorNativo";
import { fechaProxima, guardarProxima, OPCIONES_PROXIMA, reprogramar } from "../avisos/recordatorios";
import { perfilesSocio } from "../socio/socio";
import { FirmasGrupo } from "./FirmasGrupo";
import { FilaConteo, Sello } from "./piezasCierre";
import { PASOS, type ReunionLocal } from "./reunion";

interface PropsPaso {
  sesion: Sesion;
  foto: FotoGrupo;
  reunion: ReunionLocal;
  alSeguir: () => void;
  alVolver: () => void;
  alCambiar: () => void;
}

// --- paso 7: arqueo a ciegas -----------------------------------------------------------------

export function PasoArqueo(props: PropsPaso) {
  const [fase, setFase] = useState<"billetes" | "monedas" | "revelado" | null>(null);
  const [conteo, setConteo] = useState<Conteo>({});
  const [arqueo, setArqueo] = useState<Arqueo | null>(null);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    void arqueoGuardado(props.sesion.base, props.reunion.id).then((a) => {
      setArqueo(a);
      if (a) {
        setConteo(a.conteo);
        setMotivo(a.motivo);
      }
      setFase(a ? "revelado" : "billetes");
    });
  }, [props.sesion, props.reunion.id]);

  if (!fase) return null;

  if (fase !== "revelado") {
    const monedas = fase === "monedas";
    const denominaciones = monedas ? MONEDAS : BILLETES;
    return (
      <>
        <ScrollView contentContainerStyle={base.contenido}>
          <Titulo>{monedas ? "Ahora las monedas" : "Cuenten los billetes"}</Titulo>
          <Parrafo tenue>Cuenten la caja sin mirar cuánto debería haber.</Parrafo>
          <View style={{ marginTop: 10 }}>
            {denominaciones.map((valor) => (
              <FilaConteo key={valor} valor={valor} moneda={monedas} cuenta={conteo[valor] ?? 0} alCambiar={(n) => setConteo({ ...conteo, [valor]: n })} />
            ))}
          </View>
          <Total testID="arqueo-total" pesos={totalConteo(conteo)} etiqueta="Contado" />
        </ScrollView>
        <Acciones fila>
          <BotonVolver testID="paso-anterior" alTocar={() => (monedas ? setFase("billetes") : props.alVolver())} />
          {monedas ? (
            <BotonPrincipal
              testID="termine-de-contar"
              texto="Terminé de contar"
              alTocar={async () => {
                const esperado = await esperadoEnCaja(props.sesion.base, props.reunion, props.foto);
                await guardarConteo(props.sesion.base, props.reunion.id, conteo, esperado);
                setArqueo(await arqueoGuardado(props.sesion.base, props.reunion.id));
                setFase("revelado");
              }}
            />
          ) : (
            <BotonPrincipal testID="contar-monedas" texto="Contar las monedas" alTocar={() => setFase("monedas")} />
          )}
        </Acciones>
      </>
    );
  }

  const diferencia = arqueo!.contado - arqueo!.esperado;
  const cerrado = Boolean(arqueo!.cerradaEn);
  return (
    <>
      <ScrollView contentContainerStyle={base.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>{PASOS[6]}</Titulo>
        <View style={estilos.comparar}>
          <View style={estilos.compararCelda}>
            <Dinero pesos={arqueo!.contado} etiqueta="Contaron" />
          </View>
          <View style={estilos.compararCelda}>
            <Dinero pesos={arqueo!.esperado} etiqueta="Debería haber" />
          </View>
        </View>
        <Animated.View entering={FadeIn.duration(260).delay(120)} style={[estilos.veredicto, diferencia === 0 ? estilos.veredictoBien : estilos.veredictoAviso]}>
          {diferencia === 0 ? <Listo size={30} color={c.bien} weight="fill" /> : null}
          <Text style={[estilos.veredictoTexto, { color: diferencia === 0 ? c.bien : c.aviso }]} testID="arqueo-resultado">
            {diferencia === 0
              ? "Cuadra al peso."
              : diferencia < 0
                ? `Faltan ${formatearPesos(-diferencia)}. Anoten el motivo.`
                : `Sobran ${formatearPesos(diferencia)}. Anoten el motivo.`}
          </Text>
        </Animated.View>
        {diferencia !== 0 ? (
          <>
            <Rotulo>Motivo de la diferencia</Rotulo>
            <TextInput
              testID="arqueo-motivo"
              editable={!cerrado}
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Por ejemplo: se pagó el refrigerio"
              placeholderTextColor={c.tenue}
              style={estilos.motivo}
              multiline
              accessibilityLabel="Motivo de la diferencia"
            />
            <Parrafo tenue>La diferencia la firman dos cargos con el cierre.</Parrafo>
          </>
        ) : null}
      </ScrollView>
      <Acciones fila>
        {cerrado ? null : <BotonVolver testID="volver-a-contar" texto="Volver a contar" alTocar={() => setFase("billetes")} />}
        <BotonPrincipal
          testID="seguir-cierre"
          texto="Seguir al cierre"
          falta={diferencia !== 0 && !motivo.trim() ? "Falta el motivo" : undefined}
          alTocar={async () => {
            if (diferencia !== 0 && !cerrado) await guardarMotivo(props.sesion.base, props.reunion.id, motivo);
            props.alSeguir();
          }}
        />
      </Acciones>
    </>
  );
}

// --- paso 8: cierre --------------------------------------------------------------------------

export function PasoCierre(props: PropsPaso) {
  const { entorno } = useSesion();
  const [arqueo, setArqueo] = useState<Arqueo | null | undefined>(undefined);
  const [correcciones, setCorrecciones] = useState<Elemento[]>([]);
  const [firmando, setFirmando] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void Promise.all([arqueoGuardado(props.sesion.base, props.reunion.id), correccionesDeHoy(props.sesion.base, props.reunion.id)]).then(([a, c]) => {
      setArqueo(a);
      setCorrecciones(c);
    });
  }, [props.sesion, props.reunion.id, version]);

  if (arqueo === undefined) return null;

  if (arqueo?.cerradaEn) {
    return (
      <>
        <ScrollView contentContainerStyle={[base.contenido, estilos.cerrada]}>
          <Sello acap={props.foto.acap.nombre} fecha={props.reunion.fecha} />
          <Text style={estilos.cerradaTexto} testID="reunion-cerrada">
            Reunión cerrada · Guardado en este celular
          </Text>
          <ProximaReunion foto={props.foto} />
        </ScrollView>
        <Acciones>
          <BotonPrincipal testID="ver-resumen" texto="Ver el resumen de cada uno" alTocar={props.alSeguir} />
        </Acciones>
      </>
    );
  }

  if (firmando && arqueo) {
    return (
      <FirmasGrupo
        titulo="Firmar el cierre"
        permiso="firma_cierre"
        foto={props.foto}
        lista={
          <View style={{ paddingVertical: 14, gap: 4 }}>
            <Text style={base.etiqueta}>Caja contada</Text>
            <Text style={base.cifraRenglon}>{formatearPesos(arqueo.contado)}</Text>
            <Text style={base.letras}>Con estas firmas la reunión se cierra.</Text>
          </View>
        }
        alFirmar={async (firmantes) => {
          await cerrarReunion(props.sesion.base, props.sesion.cripto, {
            reunion: props.reunion,
            firmantes,
            foto: props.foto,
            ahora: entorno.ahora(),
          });
          setFirmando(false);
          setVersion((v) => v + 1);
          props.alCambiar();
        }}
        alCancelar={() => setFirmando(false)}
      />
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>{PASOS[7]}</Titulo>
        {!arqueo ? (
          <Nota tono="aviso">Falta contar la caja antes de cerrar.</Nota>
        ) : (
          <>
            <View style={estilos.caja}>
              <Dinero pesos={arqueo.contado} etiqueta="Caja contada" grande />
            </View>
            <Rotulo>Correcciones de hoy</Rotulo>
            {correcciones.length === 0 ? (
              <Parrafo tenue testID="sin-correcciones">
                Hoy no hubo correcciones.
              </Parrafo>
            ) : (
              <>
                <Parrafo tenue>Al firmar el cierre, la junta las ratifica.</Parrafo>
                {correcciones.map((x) => (
                  <Renglon key={x.id}>
                    <Text style={base.parrafo}>{String(x.datos.motivo)}</Text>
                  </Renglon>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
      <Acciones fila>
        <BotonVolver testID="paso-anterior" alTocar={props.alVolver} />
        <BotonPrincipal testID="firmar-cierre" texto="Firmar el cierre" falta={arqueo ? undefined : "Falta el arqueo"} alTocar={() => setFirmando(true)} />
      </Acciones>
    </>
  );
}

/** ¿Cuándo es la próxima reunión? Programa el aviso del día antes (N14). Sin permiso, nada. */
function ProximaReunion(props: { foto: FotoGrupo }) {
  const { entorno } = useSesion();
  const [elegida, setElegida] = useState<string | null>(null);
  return (
    <View style={estilos.proxima}>
      <View style={estilos.proximaCabeza}>
        <Calendario size={22} color={c.naranja} weight="duotone" />
        <Text style={estilos.proximaTitulo}>{elegida ? `Próxima reunión: ${elegida}` : "¿Cuándo es la próxima reunión?"}</Text>
      </View>
      {elegida ? (
        <Text style={base.letras}>Les avisamos el día antes.</Text>
      ) : (
        OPCIONES_PROXIMA.map((o) => (
          <BotonSecundario
            key={o.dias}
            testID={`proxima-${o.dias}`}
            texto={o.texto}
            alTocar={async () => {
              const fecha = fechaProxima(entorno.ahora(), o.dias);
              await guardarProxima(entorno.almacen, fecha);
              setElegida(fecha);
              const socios = await perfilesSocio(entorno.almacen);
              const conPrestamo = socios.filter((s) =>
                props.foto.prestamos.some(
                  (p) => p.saldo > 0 && props.foto.miembros.find((m) => m.membresia_id === s.membresiaId)?.titular_id === p.titular_id,
                ),
              ).length;
              try {
                if (await programadorNativo.pedirPermiso()) {
                  await reprogramar(programadorNativo, { proxima: fecha, acap: props.foto.acap.nombre, sociosConPrestamo: conPrestamo, ahora: entorno.ahora() });
                }
              } catch {
                // Sin avisos la app funciona igual (N14).
              }
            }}
          />
        ))
      )}
    </View>
  );
}

// --- paso 9: resumen por miembro (D27) ------------------------------------------------------

export function PasoResumen(props: PropsPaso & { alTerminar: () => void }) {
  const lista = props.foto.miembros.filter((m) => m.activo).sort((a, b) => a.numero - b.numero);
  const [indice, setIndice] = useState(0);
  const [resumen, setResumen] = useState<ResumenMiembro | null>(null);
  const miembro = lista[indice];

  useEffect(() => {
    void resumenMiembro(props.sesion.base, props.reunion, props.foto, miembro).then(setResumen);
  }, [props.sesion, props.reunion, props.foto, miembro]);

  if (!resumen) return null;
  const ultimo = indice === lista.length - 1;
  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <CabezaMiembro numero={miembro.numero} nombre={miembro.nombre_corto} detalle={`${indice + 1} de ${lista.length}`} testID="resumen-numero" />
        <View style={estilos.resumenHoy}>
          <Dinero testID="resumen-hoy" pesos={resumen.ahorroHoy} etiqueta="Ahorró hoy" grande />
        </View>
        <View style={estilos.resumenFila}>
          <View style={estilos.resumenCelda}>
            <Dinero pesos={resumen.ahorroCiclo} etiqueta="Ahorrado en el ciclo" />
          </View>
          {resumen.debePrestamo !== null ? (
            <View style={estilos.resumenCelda}>
              <Dinero pesos={resumen.debePrestamo} etiqueta="Debe del préstamo" />
            </View>
          ) : null}
        </View>
        <Text style={[base.etiqueta, { marginTop: 18 }]}>Pendiente de confirmar por la Fundación.</Text>
      </ScrollView>
      <Acciones fila>
        {indice > 0 ? <BotonVolver texto="Miembro anterior" alTocar={() => setIndice(indice - 1)} /> : null}
        {ultimo ? (
          <BotonPrincipal
            testID="terminar-reunion"
            texto="Terminar la reunión"
            sinFlecha
            alTocar={async () => {
              await terminarReunion(props.sesion.base, props.reunion.id);
              tocar.bien();
              props.alTerminar();
            }}
          />
        ) : (
          <BotonPrincipal testID="resumen-siguiente" texto="Siguiente" alTocar={() => setIndice(indice + 1)} />
        )}
      </Acciones>
    </>
  );
}

const estilos = StyleSheet.create({
  comparar: { flexDirection: "row", gap: 10, marginTop: 6 },
  compararCelda: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: c.mesa },
  veredicto: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, padding: 16, borderRadius: 16 },
  veredictoBien: { backgroundColor: c.bienTinte },
  veredictoAviso: { backgroundColor: c.avisoTinte },
  veredictoTexto: { ...t["campo-subtitulo"], flex: 1 },
  motivo: {
    ...t.body,
    color: c.tinta,
    borderWidth: 2,
    borderColor: c.tinta,
    borderRadius: 16,
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  caja: { marginTop: 4, padding: 16, borderRadius: 16, backgroundColor: c.mesa },
  cerrada: { flexGrow: 1, alignItems: "center", paddingTop: 36 },
  cerradaTexto: { ...t["body-fuerte"], color: c.bien, textAlign: "center", marginTop: 6 },
  proxima: { alignSelf: "stretch", gap: 10, marginTop: 26, padding: 16, borderRadius: 18, backgroundColor: c.mesa },
  proximaCabeza: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  proximaTitulo: { ...t["body-fuerte"], color: c.tinta, flex: 1 },
  resumenHoy: { padding: 18, borderRadius: 18, backgroundColor: c.naranjaTinte },
  resumenFila: { flexDirection: "row", gap: 10, marginTop: 10 },
  resumenCelda: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: c.mesa },
});

