#!/usr/bin/env node
// Genera los tokens de diseño desde el bloque YAML de DESIGN.md:
//   - css/tokens.css  → variables CSS para la web (Next.js)
//   - src/tokens.ts   → objeto tipado para la app Android (React Native, 1 px = 1 dp)
//
// DESIGN.md es la única fuente de verdad del diseño. Para cambiar un color, una fuente o un
// espaciado se edita DESIGN.md y se corre `npm run tokens`; nunca se editan las salidas a mano.
// `npm run tokens:check` falla si alguna salida no coincide con DESIGN.md (lo corre CI).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const paquete = join(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(paquete, "..", "..", "DESIGN.md");
const destinoCss = join(paquete, "css", "tokens.css");
const destinoTs = join(paquete, "src", "tokens.ts");

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function leerTokens() {
  const texto = readFileSync(origen, "utf8").replace(/\r\n/g, "\n");
  const m = texto.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error("DESIGN.md no tiene bloque YAML de tokens al inicio.");
  return parse(m[1]);
}

function referencia(valor, tokens, alResolver) {
  if (typeof valor !== "string") return valor;
  const m = valor.match(/^\{(\w+)\.([\w-]+)\}$/);
  if (!m) return valor;
  const [, grupo, nombre] = m;
  if (!tokens[grupo] || !(nombre in tokens[grupo])) {
    throw new Error(`Referencia rota en DESIGN.md: {${grupo}.${nombre}}`);
  }
  return alResolver(grupo, nombre);
}

// --- CSS (web) ----------------------------------------------------------------------------

const PREFIJO = { colors: "color", rounded: "rounded", spacing: "spacing", typography: "tipo" };

// Variables definidas en css/fuentes.css.
const FUENTES_CSS = {
  "Atkinson Hyperlegible Next": "var(--fuente-atkinson-next)",
  "Atkinson Hyperlegible Mono": "var(--fuente-atkinson-mono)",
  Bitter: "var(--fuente-bitter)",
};

function generarCss(tokens) {
  const lineas = [];
  const sec = (titulo) => lineas.push("", `  /* ${titulo} */`);

  sec("Color");
  for (const [k, v] of Object.entries(tokens.colors ?? {})) lineas.push(`  --color-${k}: ${v};`);

  sec("Tipografía (las familias están en fuentes.css)");
  for (const [rol, props] of Object.entries(tokens.typography ?? {})) {
    for (const [p, v] of Object.entries(props)) {
      if (p === "fontFamily") {
        const variable = FUENTES_CSS[v];
        if (!variable) throw new Error(`Fuente sin cargar: ${v}. Agregarla a FUENTES_CSS y a css/fuentes.css.`);
        lineas.push(`  --tipo-${rol}-familia: ${variable};`);
      } else if (p === "fontFeature") {
        lineas.push(`  --tipo-${rol}-rasgos: "${v}";`);
      } else {
        lineas.push(`  --tipo-${rol}-${kebab(p).replace("font-", "")}: ${v};`);
      }
    }
  }

  sec("Radios");
  for (const [k, v] of Object.entries(tokens.rounded ?? {})) lineas.push(`  --rounded-${k}: ${v};`);

  sec("Espaciado");
  for (const [k, v] of Object.entries(tokens.spacing ?? {})) lineas.push(`  --spacing-${k}: ${v};`);

  sec("Componentes");
  for (const [comp, props] of Object.entries(tokens.components ?? {})) {
    for (const [p, v] of Object.entries(props)) {
      const valor = referencia(v, tokens, (g, n) => `var(--${PREFIJO[g]}-${n})`);
      lineas.push(`  --${comp}-${kebab(p)}: ${valor};`);
    }
  }

  return [
    "/* GENERADO por packages/tokens/scripts/generar.mjs desde DESIGN.md. No editar a mano. */",
    "/* Para cambiar el diseño: editar DESIGN.md y correr `npm run tokens`. */",
    ":root {" + lineas.join("\n"),
    "}",
    "",
  ].join("\n");
}

// --- React Native (app) --------------------------------------------------------------------

// Android necesita un archivo estático por peso (fuentes/nativas/, generadas por
// scripts/fuentes_nativas.py). Cada peso es su propia familia, p. ej. "Bitter-700", y la app
// no pasa fontWeight: así Android no engrosa la letra por su cuenta.
const FUENTES_RN = {
  "Atkinson Hyperlegible Next": "AtkinsonHyperlegibleNext",
  "Atkinson Hyperlegible Mono": "AtkinsonHyperlegibleMono",
  Bitter: "Bitter",
};

/** "18px" → 18, "1.125rem" → 18, "clamp(2rem, 4vw, 3rem)" → 32 (el mínimo), "0.04em" → em relativo. */
function medida(valor) {
  if (typeof valor === "number") return valor;
  const clamp = String(valor).match(/^clamp\(\s*([^,]+),/);
  const base = clamp ? clamp[1].trim() : String(valor).trim();
  const m = base.match(/^(-?[\d.]+)(px|rem)?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2] === "rem" ? n * 16 : n;
}

function generarRn(tokens) {
  const color = { ...tokens.colors };

  const tipo = {};
  for (const [rol, props] of Object.entries(tokens.typography ?? {})) {
    const t = {};
    if (props.fontFamily) {
      if (!FUENTES_RN[props.fontFamily]) throw new Error(`Fuente sin nombre RN: ${props.fontFamily}`);
      const familia = `${FUENTES_RN[props.fontFamily]}-${props.fontWeight ?? 400}`;
      if (!existsSync(join(paquete, "fuentes", "nativas", `${familia}.ttf`))) {
        throw new Error(`Falta fuentes/nativas/${familia}.ttf. Agregar el peso en scripts/fuentes_nativas.py y correrlo.`);
      }
      t.fontFamily = familia;
    }
    const tam = medida(props.fontSize);
    if (tam !== undefined) t.fontSize = tam;
    if (props.lineHeight !== undefined && tam !== undefined) t.lineHeight = Math.round(Number(props.lineHeight) * tam);
    const em = String(props.letterSpacing ?? "").match(/^(-?[\d.]+)em$/);
    if (em && tam !== undefined) t.letterSpacing = Number((Number(em[1]) * tam).toFixed(2));
    if (props.fontFeature === "tnum") t.fontVariant = ["tabular-nums"];
    tipo[rol] = t;
  }

  const numeros = (grupo) =>
    Object.fromEntries(Object.entries(grupo ?? {}).map(([k, v]) => [k, medida(v)]));
  const rounded = numeros(tokens.rounded);
  const spacing = numeros(tokens.spacing);

  const grupos = { colors: color, rounded, spacing };
  const valorRn = (v) => {
    const resuelto = referencia(v, tokens, (g, n) => grupos[g][n]);
    return typeof resuelto === "string" && /(px|rem)$/.test(resuelto) ? medida(resuelto) : resuelto;
  };
  const componentes = {};
  for (const [comp, props] of Object.entries(tokens.components ?? {})) {
    componentes[comp] = Object.fromEntries(Object.entries(props).map(([p, v]) => [p, valorRn(v)]));
  }

  const cuerpo = JSON.stringify({ color, tipo, rounded, spacing, componentes }, null, 2);
  return [
    "// GENERADO por packages/tokens/scripts/generar.mjs desde DESIGN.md. No editar a mano.",
    "// Para cambiar el diseño: editar DESIGN.md y correr `npm run tokens`.",
    "// Unidades: 1 px de DESIGN.md = 1 dp en Android (sección \"Superficie nativa\").",
    "",
    `export const tokens = ${cuerpo} as const;`,
    "",
    "export type Tokens = typeof tokens;",
    "",
  ].join("\n");
}

// --- escribir o verificar ------------------------------------------------------------------

const tokens = leerTokens();
const salidas = [
  [destinoCss, generarCss(tokens)],
  [destinoTs, generarRn(tokens)],
];

if (process.argv.includes("--check")) {
  let ok = true;
  for (const [ruta, contenido] of salidas) {
    let actual = "";
    try {
      actual = readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
    } catch {
      /* no existe todavía */
    }
    if (actual !== contenido) {
      console.error(`${ruta} no coincide con DESIGN.md. Correr \`npm run tokens\` y commitear.`);
      ok = false;
    }
  }
  if (!ok) process.exit(1);
  console.log("Tokens al día con DESIGN.md (CSS y React Native).");
} else {
  for (const [ruta, contenido] of salidas) {
    writeFileSync(ruta, contenido);
    console.log(`Escrito ${ruta}`);
  }
}
