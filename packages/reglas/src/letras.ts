// Monto en letras bajo toda cifra de dinero (D17 de diseño, DESIGN.md "Dinero"): «cincuenta mil
// pesos». Español de Colombia: apócope ante sustantivo (un peso, veintiún mil, treinta y un
// millones), «cien» exacto y «de pesos» después de millones exactos. Solo pesos enteros.

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ_A_VEINTINUEVE = [
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete",
  "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos",
  "ochocientos", "novecientos",
];

/** «uno» → «un» y «veintiuno» → «veintiún» cuando va antes de un sustantivo. */
function apocopar(texto: string): string {
  return texto.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
}

function menorQueMil(n: number, apocope: boolean): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  let texto: string;
  if (resto < 10) texto = UNIDADES[resto];
  else if (resto < 30) texto = DIEZ_A_VEINTINUEVE[resto - 10];
  else {
    const unidad = resto % 10;
    texto = DECENAS[Math.floor(resto / 10)] + (unidad ? ` y ${UNIDADES[unidad]}` : "");
  }
  if (apocope) texto = apocopar(texto);
  return [CENTENAS[centena], texto].filter(Boolean).join(" ");
}

function menorQueUnMillon(n: number, apocope: boolean): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (miles === 1) partes.push("mil");
  else if (miles > 1) partes.push(`${menorQueMil(miles, true)} mil`);
  if (resto) partes.push(menorQueMil(resto, apocope));
  return partes.join(" ");
}

function numero(n: number, apocope: boolean): string {
  const escalas: [number, string, string][] = [
    [1e12, "un billón", "billones"],
    [1e6, "un millón", "millones"],
  ];
  const partes: string[] = [];
  let resto = n;
  for (const [valor, uno, varios] of escalas) {
    const cuantos = Math.floor(resto / valor);
    resto %= valor;
    if (cuantos === 1) partes.push(uno);
    else if (cuantos > 1) partes.push(`${menorQueUnMillon(cuantos, true)} ${varios}`);
  }
  if (resto) partes.push(menorQueUnMillon(resto, apocope));
  return partes.join(" ");
}

/** 50000 → «cincuenta mil pesos»; 2000000 → «dos millones de pesos»; 1 → «un peso». */
export function enLetras(pesos: number): string {
  if (!Number.isSafeInteger(pesos)) throw new TypeError("El dinero se maneja en pesos enteros.");
  if (pesos < 0) return `menos ${enLetras(-pesos)}`;
  if (pesos === 0) return "cero pesos";
  if (pesos === 1) return "un peso";
  const texto = numero(pesos, true);
  return pesos % 1e6 === 0 ? `${texto} de pesos` : `${texto} pesos`;
}
