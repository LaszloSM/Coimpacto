// GENERADO por packages/tokens/scripts/generar.mjs desde DESIGN.md. No editar a mano.
// Para cambiar el diseño: editar DESIGN.md y correr `npm run tokens`.
// Unidades: 1 px de DESIGN.md = 1 dp en Android (sección "Superficie nativa").

export const tokens = {
  "color": {
    "tinta": "#10213D",
    "tinta-suave": "#3D4A60",
    "navy": "#1B3A6B",
    "navy-tinte": "#E4EAF3",
    "naranja": "#F07B22",
    "naranja-presionado": "#D96A15",
    "on-naranja": "#10213D",
    "papel": "#FFFFFF",
    "papel-oficina": "#F2F4F7",
    "renglon": "#D5DCE6",
    "renglon-fuerte": "#AEB9C8",
    "confirmado": "#124B2E",
    "confirmado-tinte": "#E8F4EC",
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
      "fontFamily": "Bitter-700",
      "fontSize": 32,
      "letterSpacing": -0.32
    },
    "heading": {
      "fontFamily": "Bitter-600",
      "fontSize": 28
    },
    "body": {
      "fontFamily": "AtkinsonHyperlegibleNext-400",
      "fontSize": 18,
      "lineHeight": 27
    },
    "body-oficina": {
      "fontFamily": "AtkinsonHyperlegibleNext-400",
      "fontSize": 16,
      "lineHeight": 24
    },
    "campo-titulo": {
      "fontFamily": "AtkinsonHyperlegibleNext-700",
      "fontSize": 26,
      "lineHeight": 31
    },
    "cifra-clave": {
      "fontFamily": "AtkinsonHyperlegibleNext-800",
      "fontSize": 44,
      "lineHeight": 48,
      "fontVariant": ["tabular-nums"] as "tabular-nums"[]
    },
    "cifra-renglon": {
      "fontFamily": "AtkinsonHyperlegibleNext-700",
      "fontSize": 22,
      "fontVariant": ["tabular-nums"] as "tabular-nums"[]
    },
    "label": {
      "fontFamily": "AtkinsonHyperlegibleNext-600",
      "fontSize": 14,
      "letterSpacing": 0
    },
    "mono": {
      "fontFamily": "AtkinsonHyperlegibleMono-400",
      "fontSize": 14,
      "fontVariant": ["tabular-nums"] as "tabular-nums"[]
    }
  },
  "rounded": {
    "sm": 4,
    "md": 8,
    "lg": 12,
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
      "backgroundColor": "#F07B22",
      "textColor": "#10213D",
      "rounded": 8,
      "height": 56
    },
    "button-primary-active": {
      "backgroundColor": "#D96A15"
    },
    "button-secondary": {
      "backgroundColor": "#FFFFFF",
      "textColor": "#10213D",
      "borderColor": "#10213D",
      "rounded": 8,
      "height": 56
    },
    "button-disabled": {
      "backgroundColor": "#ECEFF4",
      "textColor": "#3D4A60",
      "borderColor": "#AEB9C8"
    },
    "tecla": {
      "backgroundColor": "#F2F4F7",
      "textColor": "#10213D",
      "borderColor": "#AEB9C8",
      "rounded": 8,
      "height": 56
    },
    "renglon": {
      "borderColor": "#D5DCE6",
      "height": 64
    },
    "dinero": {
      "borderColor": "#10213D",
      "rounded": 8
    },
    "estado": {
      "rounded": 4
    },
    "billete": {
      "borderColor": "#AEB9C8",
      "rounded": 4
    },
    "sello": {
      "borderColor": "#124B2E",
      "textColor": "#124B2E",
      "rounded": 9999
    },
    "sidebar-oficina": {
      "backgroundColor": "#1B3A6B",
      "textColor": "#FFFFFF"
    },
    "nav-link-activo": {
      "backgroundColor": "#FFFFFF",
      "textColor": "#1B3A6B",
      "rounded": 4
    }
  }
} as const;

export type Tokens = typeof tokens;
