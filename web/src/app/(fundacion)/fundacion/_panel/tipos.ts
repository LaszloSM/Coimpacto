// Forma de /api/oficina/tablero (backend/acap/tablero.py).

export type EstadoComunidad = "al_dia" | "atencion" | "mora" | "sin_datos";

export interface Comunidad {
  id: string;
  nombre: string;
  zona: string;
  municipio: string;
  estado: EstadoComunidad;
  ahorro: number;
  meta: number | null;
  cartera: number;
  mora: number;
  cumplimiento: number | null;
  reuniones: number;
  dias_sin_datos: number | null;
}

export interface Hallazgo {
  tono: "alerta" | "bien" | "neutro";
  acap_id: string | null;
  texto: string;
}

export interface Tablero {
  generado_en: string;
  datos_al: string | null;
  resumen: {
    ahorro: number;
    ahorro_variacion: number | null;
    cartera: number;
    comunidades_activas: number;
    comunidades: number;
    miembros: number;
    miembros_variacion: number | null;
  };
  indicadores: {
    cumplimiento: number | null;
    mora: number;
    cartera_vencida: number;
    capacitaciones: number | null;
    proyectos: number | null;
  };
  pulso: Comunidad[];
  hallazgos: Hallazgo[];
  series: {
    mensual: { mes: string; ahorro: number; credito: number }[];
    zonas: { zona: string; comunidades: number; cumplimiento: number | null; mora: number }[];
    top: { nombre: string; ahorro: number; meta: number | null }[];
    nuevos: { mes: string; miembros: number; creditos: number }[];
  };
}
