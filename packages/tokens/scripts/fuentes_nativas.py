# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools==4.60.1", "brotli==1.1.0"]
# ///
"""Genera las fuentes estáticas .ttf de la app Android desde los .woff2 variables de la web.

Android no lee .woff2 ni elige el peso de una fuente variable por `fontWeight`, así que la app
registra un archivo por peso con su propio nombre de familia (por ejemplo
`AtkinsonHyperlegibleNext-700`). Los pesos salen de los tokens de DESIGN.md; el subconjunto
"latin" cubre el español (á, é, í, ó, ú, ñ, ü, ¿, ¡).

Uso: `uv run packages/tokens/scripts/fuentes_nativas.py` (también lo llama `npm run fuentes`).
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FUENTES = Path(__file__).resolve().parent.parent / "fuentes"
DESTINO = FUENTES / "nativas"

# Familia RN → (archivo variable, pesos que usan los tokens). Mantener igual a FUENTES_RN
# en scripts/generar.mjs.
INSTANCIAS = {
    "AtkinsonHyperlegibleNext": ("atkinson-next-latin.woff2", [400, 600, 700, 800]),
    "AtkinsonHyperlegibleMono": ("atkinson-mono-latin.woff2", [400]),
    "BricolageGrotesque": ("bricolage-latin.woff2", [700, 800]),
}

# Ejes fijos además del peso. Bricolage trae tamaño óptico y ancho: los títulos de la app miden
# entre 22 y 32 dp, así que se fija el corte de 28 (ni el de texto ni el de cartel) y ancho normal.
EJES_FIJOS = {"BricolageGrotesque": {"opsz": 28, "wdth": 100}}


def main() -> None:
    DESTINO.mkdir(exist_ok=True)
    for familia, (archivo, pesos) in INSTANCIAS.items():
        for peso in pesos:
            fuente = TTFont(FUENTES / archivo)
            ejes = {"wght": peso, **EJES_FIJOS.get(familia, {})}
            estatica = instantiateVariableFont(fuente, ejes, updateFontNames=False)
            estatica.flavor = None
            nombre = f"{familia}-{peso}"
            # Nombre de familia propio por peso: así Android no mezcla ni engrosa pesos.
            for registro in estatica["name"].names:
                if registro.nameID in (1, 4, 16):
                    registro.string = nombre
                elif registro.nameID == 6:
                    registro.string = nombre.replace(" ", "")
                elif registro.nameID in (2, 17):
                    registro.string = "Regular"
            for id_tipografico in (16, 17):
                estatica["name"].removeNames(nameID=id_tipografico)
            estatica["OS/2"].usWeightClass = 400
            estatica["head"].macStyle = 0
            estatica["OS/2"].fsSelection = (estatica["OS/2"].fsSelection & ~0b100001) | 0b1000000
            estatica.save(DESTINO / f"{nombre}.ttf")
            print(f"Escrito {DESTINO / f'{nombre}.ttf'}")


if __name__ == "__main__":
    main()
