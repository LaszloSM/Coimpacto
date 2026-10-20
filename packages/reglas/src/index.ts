// Reglas de dinero compartidas por la web (back-office) y la app Android.
export { pesos, pisoCociente, redondearCociente, ReglaInvalida, tasaPorcentaje } from "./aritmetica";
export { canonico, hashCanonico, ValorNoCanonico, type ValorJson } from "./canonico";
export { previewCierre, type EntradaCierre, type MiembroCierre, type PoliticaCierre } from "./cierre";
export { formatearPesos } from "./dinero";
export { enLetras } from "./letras";
export { calcularPrestamo, dividirAbono, type DatosAbono, type Prestamo } from "./prestamo";
export { montosRegistro, type EntradaRegistro } from "./registro";
