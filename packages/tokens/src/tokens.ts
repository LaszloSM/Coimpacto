// GENERADO por packages/tokens/scripts/generar.mjs desde DESIGN.md. No editar a mano.
// Para cambiar el diseño: editar DESIGN.md y correr `npm run tokens`.
// Unidades: 1 px de DESIGN.md = 1 dp en Android (sección "Superficie nativa").

export const tokens = {
  "color": {
    "tinta": "#10213D",
    "tinta-suave": "#3D4A60",
    "tinta-tenue": "#5B6678",
    "papel": "#FFFFFF",
    "mesa": "#F2F3F0",
    "hueco": "#ECEEF1",
    "renglon": "#E1E5EC",
    "renglon-fuerte": "#C5CDD9",
    "naranja": "#F66A03",
    "naranja-presionado": "#DB5E00",
    "naranja-tinte": "#FFF0E3",
    "naranja-texto": "#A84500",
    "on-naranja": "#10213D",
    "azul": "#005FC5",
    "azul-tinte": "#E7EFFA",
    "confirmado": "#124B2E",
    "confirmado-tinte": "#E3F2E8",
    "provisional": "#3D4A60",
    "provisional-tinte": "#ECEFF4",
    "rechazado": "#7E1712",
    "rechazado-tinte": "#FCE8E6",
    "en-conflicto": "#5A2D82",
    "en-conflicto-tinte": "#F1EAF8",
    "por-validar": "#5E3C00",
    "por-validar-tinte": "#FCF2DD",
    "con-observaciones": "#1B3A6B",
    "con-observaciones-tinte": "#E4EAF3",
    "billete-2000": "#2E7FC1",
    "billete-5000": "#8A5A3B",
    "billete-10000": "#C8332B",
    "billete-20000": "#E9822F",
    "billete-50000": "#7D4A9E",
    "billete-100000": "#3C8C4A"
  },
  "tipo": {
    "display": {
      "fontFamily": "BricolageGrotesque-800",
      "fontSize": 32,
      "lineHeight": 34,
      "letterSpacing": -0.96
    },
    "heading": {
      "fontFamily": "BricolageGrotesque-700",
      "fontSize": 20,
      "lineHeight": 24,
      "letterSpacing": -0.3
    },
    "campo-titulo": {
      "fontFamily": "BricolageGrotesque-800",
      "fontSize": 30,
      "lineHeight": 33,
      "letterSpacing": -0.6
    },
    "campo-subtitulo": {
      "fontFamily": "BricolageGrotesque-700",
      "fontSize": 22,
      "lineHeight": 25,
      "letterSpacing": -0.22
    },
    "body": {
      "fontFamily": "AtkinsonHyperlegibleNext-400",
      "fontSize": 18,
      "lineHeight": 26
    },
    "body-fuerte": {
      "fontFamily": "AtkinsonHyperlegibleNext-700",
      "fontSize": 18,
      "lineHeight": 24
    },
    "body-oficina": {
      "fontFamily": "AtkinsonHyperlegibleNext-400",
      "fontSize": 15,
      "lineHeight": 23
    },
    "cifra-clave": {
      "fontFamily": "AtkinsonHyperlegibleNext-800",
      "fontSize": 44,
      "lineHeight": 46,
      "letterSpacing": -0.88,
      "fontVariant": ["tabular-nums"] as "tabular-nums"[]
    },
    "cifra-renglon": {
      "fontFamily": "AtkinsonHyperlegibleNext-700",
      "fontSize": 22,
      "lineHeight": 26,
      "fontVariant": ["tabular-nums"] as "tabular-nums"[]
    },
    "label": {
      "fontFamily": "AtkinsonHyperlegibleNext-600",
      "fontSize": 14,
      "lineHeight": 18,
      "letterSpacing": 0.14
    },
    "mono": {
      "fontFamily": "AtkinsonHyperlegibleMono-400",
      "fontSize": 13,
      "fontVariant": ["tabular-nums"] as "tabular-nums"[]
    }
  },
  "rounded": {
    "sm": 6,
    "md": 10,
    "lg": 14,
    "xl": 20,
    "sello": 9999
  },
  "spacing": {
    "xs": 4,
    "sm": 8,
    "md": 16,
    "lg": 24,
    "xl": 32,
    "2xl": 48,
    "3xl": 64,
    "toque-min": 56
  },
  "componentes": {
    "button-primary": {
      "backgroundColor": "#F66A03",
      "textColor": "#10213D",
      "rounded": 14,
      "height": 56
    },
    "button-primary-active": {
      "backgroundColor": "#DB5E00"
    },
    "button-secondary": {
      "backgroundColor": "#ECEEF1",
      "textColor": "#10213D",
      "borderColor": "#C5CDD9",
      "rounded": 14,
      "height": 56
    },
    "button-disabled": {
      "backgroundColor": "#ECEEF1",
      "textColor": "#3D4A60",
      "borderColor": "#E1E5EC"
    },
    "tecla": {
      "backgroundColor": "#ECEEF1",
      "textColor": "#10213D",
      "borderColor": "#E1E5EC",
      "rounded": 14,
      "height": 56
    },
    "renglon": {
      "borderColor": "#E1E5EC",
      "height": 64
    },
    "margen": {
      "borderColor": "#F66A03"
    },
    "dinero": {
      "borderColor": "#10213D",
      "rounded": 14
    },
    "estado": {
      "rounded": 6
    },
    "billete": {
      "borderColor": "#C5CDD9",
      "rounded": 10
    },
    "sello": {
      "borderColor": "#124B2E",
      "textColor": "#124B2E",
      "rounded": 9999
    }
  }
} as const;

export type Tokens = typeof tokens;
