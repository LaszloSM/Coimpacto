import { fechaProxima, recordatoriosPara, reprogramar, type Programador, type Recordatorio } from "./recordatorios";

const AHORA = new Date(2026, 9, 4, 17, 0); // 4 oct, después de cerrar la reunión

test("la próxima reunión a 1 semana, 2 semanas o 1 mes", () => {
  expect(fechaProxima(AHORA, 7)).toBe("2026-10-11");
  expect(fechaProxima(AHORA, 30)).toBe("2026-11-03");
});

test("el aviso sale el día antes a las 8:00 y no lleva montos ni nombres de personas", () => {
  const [reunion, cuota] = recordatoriosPara({ proxima: "2026-10-11", acap: "ACAP Las Brisas", sociosConPrestamo: 1, ahora: AHORA });
  expect(reunion.cuando).toEqual(new Date(2026, 9, 10, 8, 0, 0));
  expect(reunion.cuerpo).toBe("Mañana hay reunión de ACAP Las Brisas.");
  expect(cuota.cuerpo).toBe("Se acerca su cuota.");
  for (const r of [reunion, cuota]) expect(r.cuerpo).not.toMatch(/\$|\d{3}/);
});

test("sin socios con préstamo no hay aviso de cuota; si la fecha pasó, no hay avisos", () => {
  expect(recordatoriosPara({ proxima: "2026-10-11", acap: "A", sociosConPrestamo: 0, ahora: AHORA })).toHaveLength(1);
  expect(recordatoriosPara({ proxima: "2026-10-05", acap: "A", sociosConPrestamo: 1, ahora: AHORA })).toHaveLength(0);
});

test("reprogramar borra los avisos anteriores y programa los nuevos", async () => {
  const programados: Recordatorio[] = [];
  const programador: Programador = {
    pedirPermiso: async () => true,
    cancelarTodos: async () => {
      programados.length = 0;
    },
    programar: async (r) => {
      programados.push(r);
    },
  };
  await reprogramar(programador, { proxima: "2026-10-11", acap: "A", sociosConPrestamo: 1, ahora: AHORA });
  await reprogramar(programador, { proxima: "2026-10-18", acap: "A", sociosConPrestamo: 0, ahora: AHORA });
  expect(programados.map((r) => r.id)).toEqual(["reunion-2026-10-18"]);
});
