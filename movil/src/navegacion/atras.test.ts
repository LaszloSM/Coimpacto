import { atrasEnAsistente } from "./atras";

const en = (paso: number, miembro = 0, hayReunion = true) => atrasEnAsistente({ paso, miembro, hayReunion, ultimoMiembro: 19 });

test.each([
  [en(1, 0, false), { tipo: "confirmar-salir" }],
  [en(3), { tipo: "confirmar-salir" }],
  [en(4, 0), { tipo: "ir", paso: 3 }],
  [en(4, 7), { tipo: "ir", paso: 4, miembro: 6 }],
  [en(5), { tipo: "ir", paso: 4, miembro: 19 }],
  [en(6), { tipo: "ir", paso: 5 }],
  [en(8), { tipo: "ir", paso: 7 }],
  [en(9), { tipo: "nada" }],
])("atrás en %o", (resultado, esperado) => {
  expect(resultado).toEqual(esperado);
});
