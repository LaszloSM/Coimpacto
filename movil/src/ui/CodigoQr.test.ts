import { create } from "qrcode";

import { tramosQr } from "./CodigoQr";

test("los tramos de cada fila cubren exactamente los módulos oscuros del QR", () => {
  const texto = "https://credimpacto.example/comprobante/abc:def";
  const { modules } = create(texto, { errorCorrectionLevel: "M" });
  const { tamano, filas } = tramosQr(texto);
  expect(tamano).toBe(modules.size);
  for (let y = 0; y < tamano; y++) {
    const oscuros = new Set<number>();
    for (const [inicio, largo] of filas[y]) for (let x = inicio; x < inicio + largo; x++) oscuros.add(x);
    for (let x = 0; x < tamano; x++) expect(oscuros.has(x)).toBe(Boolean(modules.get(y, x)));
  }
});
