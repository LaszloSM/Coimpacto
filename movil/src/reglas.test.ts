import { canonico, formatearPesos } from "@credimpacto/reglas";

// La app usa el mismo paquete de reglas que la web y que los casos compartidos con el
// servidor; esta prueba confirma que Jest lo resuelve desde el monorepo. hashCanonico
// necesita crypto.subtle, que Hermes no trae: llega con react-native-quick-crypto (TX3).
test("las reglas compartidas se cargan en la app", () => {
  expect(formatearPesos(50000)).toMatch(/50\.000/);
  expect(canonico({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
});
