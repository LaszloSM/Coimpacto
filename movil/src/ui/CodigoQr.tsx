// Código QR dibujado con vistas (sin SVG nativo): la librería qrcode solo calcula la matriz.
// Cada fila junta los módulos oscuros seguidos en un solo rectángulo para no crear miles de vistas.

import { tokens } from "@credimpacto/tokens";
import { create } from "qrcode";
import { useMemo } from "react";
import { View } from "react-native";

const { color } = tokens;

/** Tramos oscuros de cada fila: [inicio, largo]. */
export function tramosQr(texto: string): { tamano: number; filas: [number, number][][] } {
  const { modules } = create(texto, { errorCorrectionLevel: "M" });
  const filas: [number, number][][] = [];
  for (let y = 0; y < modules.size; y++) {
    const tramos: [number, number][] = [];
    let x = 0;
    while (x < modules.size) {
      if (!modules.get(y, x)) {
        x++;
        continue;
      }
      const inicio = x;
      while (x < modules.size && modules.get(y, x)) x++;
      tramos.push([inicio, x - inicio]);
    }
    filas.push(tramos);
  }
  return { tamano: modules.size, filas };
}

export function CodigoQr(props: { texto: string; lado: number; etiqueta: string; testID?: string }) {
  const { tamano, filas } = useMemo(() => tramosQr(props.texto), [props.texto]);
  // Margen de 4 módulos (zona tranquila) para que cualquier cámara lo lea.
  const modulo = Math.floor(props.lado / (tamano + 8));
  const borde = (props.lado - modulo * tamano) / 2;
  return (
    <View
      testID={props.testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={props.etiqueta}
      style={{ width: props.lado, height: props.lado, padding: borde, backgroundColor: color.papel }}
    >
      {filas.map((tramos, y) => (
        <View key={y} style={{ height: modulo, flexDirection: "row" }}>
          {tramos.map(([inicio, largo]) => (
            <View
              key={inicio}
              style={{ position: "absolute", left: inicio * modulo, width: largo * modulo, height: modulo, backgroundColor: color.tinta }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
