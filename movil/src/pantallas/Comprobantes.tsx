// Comprobantes de la reunión pasada (pregunta 2b, valor por defecto: QR en la siguiente reunión).
// La junta abre la lista, toca el número del miembro y le muestra su QR; el miembro lo escanea
// con su celular y ve las cifras confirmadas por la Fundación. Solo números, nunca nombres.

import { useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { FotoGrupo } from "../cola/grupo";
import { CodigoQr } from "../ui/CodigoQr";
import { Acciones, BotonPrincipal, BotonSecundario, CabezaMiembro, estilos as base, Nota, Parrafo, Renglon, Titulo } from "../ui/componentes";
import { Calendario, Ir, Recibo } from "../ui/iconos";
import { c, t } from "../ui/tema";

const numero = (n: number) => `#${String(n).padStart(2, "0")}`;
const fecha = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long" });

export function enlaceComprobante(servidor: string, token: string): string {
  return `${servidor}/comprobante/${token}`;
}

export function Comprobantes(props: { foto: FotoGrupo | null; servidor: string; alSalir: () => void }) {
  const { width } = useWindowDimensions();
  const [elegido, setElegido] = useState<number | null>(null);
  const datos = props.foto?.comprobantes;
  const lista = (props.foto?.miembros ?? [])
    .filter((m) => datos?.enlaces[m.titular_id])
    .map((m) => ({ numero: m.numero, nombre: m.nombre_corto ?? "", token: datos!.enlaces[m.titular_id] }));

  if (!datos || lista.length === 0) {
    return (
      <>
        <View style={base.contenido}>
          <Titulo>Comprobantes</Titulo>
          <Nota testID="comprobantes-vacio">
            Todavía no hay comprobantes. Aparecen cuando la Fundación confirma una reunión cerrada y este celular se conecta.
          </Nota>
        </View>
        <Acciones>
          <BotonSecundario testID="comprobantes-volver" texto="Volver al inicio" alTocar={props.alSalir} />
        </Acciones>
      </>
    );
  }

  const actual = elegido === null ? null : lista[elegido];
  if (actual) {
    const lado = Math.min(width - 96, 300);
    return (
      <>
        <ScrollView contentContainerStyle={base.contenido}>
          <CabezaMiembro numero={actual.numero} nombre={actual.nombre} testID="comprobante-numero" />
          <View style={estilos.tiquete}>
            <View style={estilos.tiqueteCabeza}>
              <Recibo size={20} color={c.naranja} weight="duotone" />
              <Text style={estilos.tiqueteTitulo}>
                Reunión {datos.reunion} · {fecha(datos.fecha)}
              </Text>
            </View>
            <View style={estilos.qr}>
              <CodigoQr testID="comprobante-qr" texto={enlaceComprobante(props.servidor, actual.token)} lado={lado} etiqueta={`Comprobante de ${numero(actual.numero)}`} />
            </View>
            <View style={estilos.corte} />
            <Parrafo>Escanee con la cámara de su celular para ver su comprobante.</Parrafo>
            <View style={estilos.vence}>
              <Calendario size={16} color={c.suave} weight="bold" />
              <Text style={estilos.venceTexto}>Sirve hasta el {fecha(datos.vence_en)}</Text>
            </View>
          </View>
        </ScrollView>
        <Acciones>
          {elegido! + 1 < lista.length ? (
            <BotonPrincipal testID="comprobante-siguiente" texto={`Siguiente: ${numero(lista[elegido! + 1].numero)}`} alTocar={() => setElegido(elegido! + 1)} />
          ) : null}
          <BotonSecundario testID="comprobante-lista" texto="Volver a la lista" alTocar={() => setElegido(null)} />
        </Acciones>
      </>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={base.contenido}>
        <Titulo>Comprobantes de la reunión {datos.reunion}</Titulo>
        <Parrafo tenue>Toque el número de cada miembro para mostrarle su código.</Parrafo>
        <View style={{ marginTop: 12 }}>
          {lista.map((m, i) => (
            <Renglon
              key={m.numero}
              numero={String(m.numero).padStart(2, "0")}
              testID={`comprobante-${m.numero}`}
              accesible={`Mostrar el código de ${numero(m.numero)}`}
              alTocar={() => setElegido(i)}
              derecha={<Ir size={20} color={c.tenue} weight="bold" />}
            >
              <Text style={base.parrafo}>{m.nombre || `Miembro ${numero(m.numero)}`}</Text>
              <Text style={base.detalleRenglon}>Mostrar código</Text>
            </Renglon>
          ))}
        </View>
      </ScrollView>
      <Acciones>
        <BotonSecundario testID="comprobantes-volver" texto="Volver al inicio" alTocar={props.alSalir} />
      </Acciones>
    </>
  );
}

const estilos = StyleSheet.create({
  tiquete: {
    padding: 18,
    gap: 12,
    borderRadius: 20,
    backgroundColor: c.papel,
    borderWidth: 1,
    borderColor: c.renglon,
    shadowColor: c.tinta,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  tiqueteCabeza: { flexDirection: "row", alignItems: "center", gap: 8 },
  tiqueteTitulo: { ...t["body-fuerte"], color: c.tinta, flex: 1 },
  qr: { alignItems: "center", paddingVertical: 8 },
  corte: { borderTopWidth: 2, borderStyle: "dashed", borderColor: c.renglonFuerte, marginHorizontal: -4 },
  vence: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, minHeight: 30, borderRadius: 999, backgroundColor: c.hueco },
  venceTexto: { ...t.label, fontSize: 14, color: c.suave },
});
