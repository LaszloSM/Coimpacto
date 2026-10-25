---
version: 1
slug: "web-src-app-fundacion-fundacion-page-tsx"
primary_target: "web/src/app/(fundacion)/fundacion/page.tsx"
related_targets: ["web/src/app/(fundacion)/fundacion/layout.tsx"]
---

# Panel de la Fundación (oficina web)

Modo: Operate. Lo usan Dirección/Gerencia, coordinadores, facilitadores y analistas de CoimpactoB en un portátil, de día, en oficina. Vista "Empresa / Banco" para aliados con usuario de solo lectura (cifras agregadas, nunca personas). La vista del socio vive en la app.

Estructura pinned por el usuario: la plataforma del mockup https://coimpacto-b.vercel.app (barra lateral; Dashboard, Ahorro ACAP, Crédito, Cartera, Proyectos, Capacitaciones, Análisis, Evaluaciones, Reportes; vistas por rol). Estilo pinned: minimalista, animaciones bien hechas, colores de CoimpactoB (coimpactob.com). Roles y cargos se administran aquí, sin QR.

Datos: todo del servidor real; sin cifras inventadas. Bloque sin datos = estado vacío que dice qué falta.

## Direction contract

THESIS: Un panel que se lee como el estado de salud de cada comunidad, no como una pared de tarjetas de métricas; rechaza el tablero genérico de KPI gris con acento y gráficos decorativos.

OWN-WORLD: Marca CoimpactoB. Barra lateral carbón #1C1C1C con texto blanco y el ítem activo en píldora naranja suave; fondo #FAFAF9; superficies blancas con borde 1px #ECEBE8, radio 14, sombra con desplazamiento. Naranja #F66A03 solo para acción principal, selección y la serie de ahorro. Paleta secundaria de CoimpactoB (azul #005FC5, verde #35A472, amarillo #F9C032, rojo #F53D45) solo para datos y estados. Poppins para títulos y cifras grandes; Roboto con cifras tabulares para tablas y texto. Íconos Phosphor de trazo regular.

STORY: Gerencia entiende en segundos cuánto ahorran y prestan las comunidades, cuáles están al día y cuáles necesitan visita, y entra a la comunidad o al módulo para actuar.

FIRST VIEWPORT: Barra lateral a la izquierda (232px) con el logo, las 9 secciones y el usuario abajo. Cabecera con el título "Panel de gerencia" y "Datos al <fecha>" (el selector de periodo se pospone: el tablero muestra el ciclo actual y el servidor aún no recibe periodo; no se pone un control inerte). Fila de cuatro cifras principales (Ahorro, Cartera activa, Comunidades activas, Miembros) sin cajas de color, con su variación. Debajo, el gesto característico: el Pulso de comunidades: arriba las que necesitan atención en filas compactas (nombre, estado y por qué), abajo las que están al día en una franja de chips; filtros por estado con reacomodo animado. El Analista ("Para mirar hoy", 2-3 hallazgos en frases cortas) va antes del pulso en una franja a todo el ancho: primero el resumen y luego el detalle, y así no queda una columna vacía al lado del pulso con las 27 ACAP reales. Cada fila del pulso cierra con el ahorro de la comunidad. Luego los gráficos de crecimiento y por zona.

FORM: Pinned por el usuario (mockup + minimalista + marca CoimpactoB); sin roll de concept-seed. Seed key: pinned-mockup-coimpactob.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
