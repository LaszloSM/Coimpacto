#!/usr/bin/env node
// Genera web/src/estilos/tokens.css desde el bloque YAML de DESIGN.md.
//
// DESIGN.md es la única fuente de verdad del diseño. Para cambiar un color, una fuente o un
// espaciado se edita DESIGN.md y se corre `npm run tokens`; nunca se edita tokens.css a mano.
// `npm run tokens:check` falla si tokens.css no coincide con DESIGN.md (lo corre CI).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(raiz, "DESIGN.md");
const destino = join(raiz, "web", "src", "estilos", "tokens.css");

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function leerTokens() {
  const texto = readFileSync(origen, "utf8").replace(/\r\n/g, "\n");
  const m = texto.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error("DESIGN.md no tiene bloque YAML de tokens al inicio.");
  return parse(m[1]);
}

// "{colors.naranja}" -> "var(--color-naranja)"
const PREFIJO = { colors: "color", rounded: "rounded", spacing: "spacing", typography: "tipo" };
function resolver(valor, tokens) {
  if (typeof valor !== "string") return String(valor);
  return valor.replace(/\{(\w+)\.([\w-]+)\}/g, (_, grupo, nombre) => {
    if (!tokens[grupo] || !(nombre in tokens[grupo])) {
      throw new Error(`Referencia rota en DESIGN.md: {${grupo}.${nombre}}`);
    }
    return `var(--${PREFIJO[grupo]}-${nombre})`;
  });
}

const FUENTES = {
  "Atkinson Hyperlegible Next": "var(--fuente-atkinson-next)",
  "Atkinson Hyperlegible Mono": "var(--fuente-atkinson-mono)",
  Bitter: "var(--fuente-bitter)",
};

function generar(tokens) {
  const lineas = [];
  const sec = (titulo) => lineas.push("", `  /* ${titulo} */`);

  sec("Color");
  for (const [k, v] of Object.entries(tokens.colors ?? {})) lineas.push(`  --color-${k}: ${v};`);

  sec("Tipografía (las familias las define next/font en layout.tsx)");
  for (const [rol, props] of Object.entries(tokens.typography ?? {})) {
    for (const [p, v] of Object.entries(props)) {
      if (p === "fontFamily") {
        const variable = FUENTES[v];
        if (!variable) throw new Error(`Fuente sin cargar en web: ${v}. Agregarla a FUENTES y a layout.tsx.`);
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
      lineas.push(`  --${comp}-${kebab(p)}: ${resolver(v, tokens)};`);
    }
  }

  return [
    "/* GENERADO por scripts/generar-tokens.mjs desde DESIGN.md. No editar a mano. */",
    "/* Para cambiar el diseño: editar DESIGN.md y correr `npm run tokens`. */",
    ":root {" + lineas.join("\n"),
    "}",
    "",
  ].join("\n");
}

const css = generar(leerTokens());

if (process.argv.includes("--check")) {
  let actual = "";
  try {
    actual = readFileSync(destino, "utf8").replace(/\r\n/g, "\n");
  } catch {
    /* no existe todavía */
  }
  if (actual !== css) {
    console.error("tokens.css no coincide con DESIGN.md. Correr `npm run tokens` y commitear.");
    process.exit(1);
  }
  console.log("tokens.css al día con DESIGN.md.");
} else {
  writeFileSync(destino, css);
  console.log(`Escrito ${destino}`);
}
