---
# gstack: design-md-format=spec
name: Credimpacto
description: La libreta de la ACAP hecha pantalla. Tinta azul sobre papel, renglones con el margen naranja del cuaderno, la caja contada billete por billete y un sello cuando todo cuadra.
colors:
  tinta: "#10213D"
  tinta-suave: "#3D4A60"
  tinta-tenue: "#5B6678"
  papel: "#FFFFFF"
  mesa: "#F2F3F0"
  hueco: "#ECEEF1"
  renglon: "#E1E5EC"
  renglon-fuerte: "#C5CDD9"
  naranja: "#F66A03"
  naranja-presionado: "#DB5E00"
  naranja-tinte: "#FFF0E3"
  naranja-texto: "#A84500"
  on-naranja: "#10213D"
  azul: "#005FC5"
  azul-tinte: "#E7EFFA"
  confirmado: "#124B2E"
  confirmado-tinte: "#E3F2E8"
  provisional: "#3D4A60"
  provisional-tinte: "#ECEFF4"
  rechazado: "#7E1712"
  rechazado-tinte: "#FCE8E6"
  en-conflicto: "#5A2D82"
  en-conflicto-tinte: "#F1EAF8"
  por-validar: "#5E3C00"
  por-validar-tinte: "#FCF2DD"
  con-observaciones: "#1B3A6B"
  con-observaciones-tinte: "#E4EAF3"
  billete-2000: "#2E7FC1"
  billete-5000: "#8A5A3B"
  billete-10000: "#C8332B"
  billete-20000: "#E9822F"
  billete-50000: "#7D4A9E"
  billete-100000: "#3C8C4A"
typography:
  display:
    fontFamily: Bricolage Grotesque
    fontWeight: 800
    fontSize: clamp(2rem, 3vw, 2.75rem)
    lineHeight: 1.05
    letterSpacing: -0.03em
  heading:
    fontFamily: Bricolage Grotesque
    fontWeight: 700
    fontSize: 1.25rem
    lineHeight: 1.2
    letterSpacing: -0.015em
  campo-titulo:
    fontFamily: Bricolage Grotesque
    fontWeight: 800
    fontSize: 1.875rem
    lineHeight: 1.1
    letterSpacing: -0.02em
  campo-subtitulo:
    fontFamily: Bricolage Grotesque
    fontWeight: 700
    fontSize: 1.375rem
    lineHeight: 1.15
    letterSpacing: -0.01em
  body:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 400
    fontSize: 1.125rem
    lineHeight: 1.45
  body-fuerte:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 700
    fontSize: 1.125rem
    lineHeight: 1.35
  body-oficina:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 400
    fontSize: 0.9375rem
    lineHeight: 1.5
  cifra-clave:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 800
    fontSize: 2.75rem
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontFeature: tnum
  cifra-renglon:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 700
    fontSize: 1.375rem
    lineHeight: 1.2
    fontFeature: tnum
  label:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 600
    fontSize: 0.875rem
    lineHeight: 1.3
    letterSpacing: 0.01em
  mono:
    fontFamily: Atkinson Hyperlegible Mono
    fontWeight: 400
    fontSize: 0.8125rem
    fontFeature: tnum
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  sello: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  toque-min: 56px
components:
  button-primary:
    backgroundColor: "{colors.naranja}"
    textColor: "{colors.on-naranja}"
    rounded: "{rounded.lg}"
    height: "{spacing.toque-min}"
  button-primary-active:
    backgroundColor: "{colors.naranja-presionado}"
  button-secondary:
    backgroundColor: "{colors.hueco}"
    textColor: "{colors.tinta}"
    borderColor: "{colors.renglon-fuerte}"
    rounded: "{rounded.lg}"
    height: "{spacing.toque-min}"
  button-disabled:
    backgroundColor: "{colors.hueco}"
    textColor: "{colors.tinta-suave}"
    borderColor: "{colors.renglon}"
  tecla:
    backgroundColor: "{colors.hueco}"
    textColor: "{colors.tinta}"
    borderColor: "{colors.renglon}"
    rounded: "{rounded.lg}"
    height: "{spacing.toque-min}"
  renglon:
    borderColor: "{colors.renglon}"
    height: 64px
  margen:
    borderColor: "{colors.naranja}"
  dinero:
    borderColor: "{colors.tinta}"
    rounded: "{rounded.lg}"
  estado:
    rounded: "{rounded.sm}"
  billete:
    borderColor: "{colors.renglon-fuerte}"
    rounded: "{rounded.md}"
  sello:
    borderColor: "{colors.confirmado}"
    textColor: "{colors.confirmado}"
    rounded: "{rounded.sello}"
---

# Credimpacto

> **Una sola libreta, dos superficies.** La app Android de la junta (reunión y vista del socio) y el panel web de la Fundación comparten los tokens de arriba, las mismas dos familias tipográficas y la misma metáfora: la libreta de la ACAP. Lo que cambia es la densidad: la app es grande y de una tarea por pantalla; el panel es denso y de revisión.

## Overview

**Creative North Star:** la libreta de la ACAP, en pantalla. Tinta azul sobre papel, el número de cada miembro a la izquierda del margen naranja, las acciones como sellos, la caja contada billete por billete con su color real y un sello «Bien contado» cuando todo cuadra. Las juntas ya confían en esos objetos; la app se ve como *su* libreta, no como un banco, y eso hace visible el principio de que no custodiamos dinero.

**Lo memorable:** «Nuestro dinero está bien contado.» Las cifras son lo más grande de la pantalla y siempre llevan su valor en letras en la app; nada se borra (corregir es tachar y reversar); la reunión termina con un sello.

**Product context:** el libro contable de los grupos de ahorro y crédito comunitario (ACAP) de la Fundación CoimpactoB, en Colombia.
- **Reunión (app Android, Expo, sin señal).** La usa la junta en un Android de gama baja, al aire libre o en un salón comunal. Baja alfabetización digital, buena aritmética. Asistente de 9 pasos; cada pantalla pregunta una cosa, como lo hacía el chatbot («¿Quién vino hoy?», «¿Cuántas acciones compra hoy?»).
- **Panel de la Fundación (web, Next.js).** Lo usan Admin, Dirección, coordinadores, facilitadores y analistas, sobre todo en portátil y a veces en el celular. Seguimiento (panel, ahorro, crédito, cartera, proyectos, capacitaciones, análisis, evaluaciones, reportes) y gestión (comunidades, personas, cargos, pendientes, por aclarar, copias de seguridad, usuarios).
- **Comprobante por enlace (web).** Lo abre el socio en su celular al escanear el código que le muestra la junta: un recibo de papel.

**Mode per surface:**
- Reunión: *Operate*. Una tarea por pantalla, cero lectura innecesaria, toques de 56 dp o más.
- Panel: *Operate* denso. Tablas, colas de revisión, consolidados, cajones laterales para editar.

**Referencias:**
- Pilotos de digitalización de grupos de ahorro: https://www.usaidlearninglab.org/community/blog/digitalizing-savings-groups-sierra-leone · https://www.responseinnovationlab.com/updates/learning-from-a-savings-group-digitisation-pilot-in-uganda · https://hivenetwork.online/2020/03/what-makes-vsla-online-different/
- 136 pautas de UI para usuarios con baja alfabetización (CSCW 2021): https://anupriyatuli.github.io/publications/2021_CSCW.pdf
- La libreta de los grupos VSLA: un sello por acción comprada en cada reunión.
- Marca de la Fundación: https://coimpactob.com (naranja #F66A03).
- Principios de interfaz y movimiento: Emil Kowalski (`emil-design-eng`, `animate`, `animate-expo`, `mobile-native`, `apple-design`) y Taste (`taste-skill`, `redesign-skill`, `soft-skill`, `minimalist-skill`).

## Colors

**Strategy:** contenida. Papel blanco, tinta azul oscuro y un solo acento: el naranja de CoimpactoB, que marca la acción de ahora y el ahorro en los datos. El resto del color significa algo: estados, billetes y series de datos.

**Solo claro.** La reunión pasa al sol en pantallas baratas; el panel comparte la marca y las pruebas de contraste. No hay modo oscuro.

**Quién señala qué:**
- `naranja`: el único botón principal de la pantalla, el margen del cuaderno (al 35–45 %), los sellos de las acciones, la serie de ahorro en los gráficos y el indicador de la pestaña activa. Su texto es siempre `on-naranja` (tinta, 5,3:1). Nunca texto blanco sobre naranja (3,0:1).
- `tinta`, `tinta-suave`, `tinta-tenue`: el texto (16:1, 9:1 y 5,8:1 sobre papel). La tinta también es el «+» de los contadores, las casillas marcadas y la ficha del número del miembro.
- `mesa`: el fondo detrás de las hojas (el panel, la pantalla de entrar, el comprobante) y los recuadros de resumen de la app.
- `hueco`: teclas, botones secundarios y fondos de segmentos.
- `renglon`, `renglon-fuerte`: rayas de los renglones y bordes.
- `azul`: la serie de crédito en los datos y los estados informativos.
- Estados (`confirmado`, `por-validar`, `rechazado`, `en-conflicto`, `provisional`, `con-observaciones`): color de texto sobre su tinte, siempre con palabra y, si cabe, ícono. Llegan a 7:1 sobre su tinte.
- Billetes: el color real de la familia nueva del Banco de la República ($2.000 azul, $5.000 café, $10.000 rojo, $20.000 naranja, $50.000 violeta, $100.000 verde), solo en el dibujo del billete del arqueo, que siempre lleva su valor escrito.

## Typography

Dos familias, OFL, autoalojadas desde `packages/tokens/fuentes` (la web con `@font-face`, la app con `expo-font`, un .ttf estático por peso). Ni el build ni la reunión dependen de Google Fonts.

- **Bricolage Grotesque** (títulos). Grotesca con carácter de imprenta, de contraste bajo; se usa en los títulos de la app (28–32 dp, peso 800) y del panel (28–40 px, peso 700–800), con seguimiento negativo (−0,02 a −0,04 em) que crece con el tamaño. En la app va fijado el corte óptico de 28 y ancho normal.
- **Atkinson Hyperlegible Next** (texto y cifras). Distingue 0/O, 1/l/I, 6/8 y 5/S, que es lo que se confunde al leer plata con poca luz. Todas las cifras usan `tnum` para alinearse como en una columna del cuaderno. Las cifras clave van en peso 800.
- **Atkinson Hyperlegible Mono**: solo códigos e identificadores (`MAXIMO_ACCIONES`, el atajo de teclado).

**Escala:**
- App: cuerpo 18 dp (mínimo); títulos 30 dp; subtítulos 22 dp; cifra en renglón 22 dp; cifra clave 44 dp (mínimo 32); valor en letras 16 dp. Crecen con la letra del sistema hasta 1,3×.
- Panel: cuerpo 15 px; etiquetas 13 px; títulos de página 30–40 px; de bloque 18 px; cifras de la franja 26–32 px.
- La jerarquía sale de tamaño, peso y seguimiento juntos, nunca de mayúsculas sostenidas.

## Layout

- **La libreta (app):** una columna con 20 dp a los lados. Arriba la franja (estado de guardado y paso N de 9 con sus segmentos); al pie, las acciones fijas sobre una raya fina. Los renglones de miembros llevan el número en una columna de 60 dp a la izquierda del **margen naranja**, que corre de arriba abajo como en el cuaderno.
- **La hoja (panel):** la barra de secciones vive sobre la mesa (252 px) y el trabajo ocurre en una hoja blanca con 18 px de radio, separada 10 px de los bordes. Contenido hasta 1280 px. Debajo de 960 px la barra pasa a un cajón y arriba queda una barra translúcida con la marca y el menú.
- **Cifras:** en una franja con divisores (no tarjetas sueltas); la primera, la del ahorro, lleva una raya naranja arriba.
- **Tablas:** encabezado tenue sobre una raya fuerte, renglones de 52 px, cifras a la derecha, la primera columna es el encabezado de su fila. Si no caben, la tabla se desplaza sola, nunca la página. Los totales llevan la **doble raya del libro de cuentas** encima.
- **Ritmo:** base de 4/8 px; 14–18 px dentro de un grupo, 28–32 px entre bloques.

## Elevation & Depth

- La profundidad es papel sobre la mesa: hojas y recibos con sombras teñidas de tinta (`rgb(16 33 61 / …)`), nunca negras.
- En el panel, bloques con borde de 1 px y sin sombra; la hoja tiene una sombra ancha y suave; lo que flota (cajón, selector, diálogo, buscador) usa `--sombra-flotante`.
- La barra superior del panel en el celular es translúcida (`backdrop-filter`) porque el contenido pasa por debajo; nada más usa desenfoque.
- En la app, sombras solo en el botón principal (sombra naranja corta) y en la hoja nueva del paso 1.

## Shapes

- Radios: `sm` 6 (etiquetas de estado), `md` 10 (campos y botones del panel), `lg` 14–16 (bloques, botones y teclas de la app), `xl` 18–20 (la hoja, cajones, el recibo, teclas del PIN), `sello` circular.
- Los puntos del PIN, el sello y las monedas son los únicos círculos completos. Los cuadros de las acciones van girados −4° como un sello a mano; el sello de cierre va girado −8°: son lo único torcido del sistema.

## Components

### Compartidos
- **Botón principal:** naranja, texto tinta en negrita, con flecha cuando lleva a otro paso y sin ella cuando termina algo (guardar, firmar). Si falta algo, dice qué falta en vez de quedarse gris y mudo.
- **Botón secundario:** fondo `hueco`, sin borde grueso. Hay uno solo por pantalla además del principal; lo demás son renglones.
- **Etiqueta de estado:** palabra sobre el tinte de su color, radio 6–8.
- **Página en blanco del cuaderno** (vacíos): renglones tenues, margen naranja, la silueta de lo que va a aparecer, un ícono, qué falta y la acción para empezar. Nunca filas de ceros.

### App (reunión)
- **Franja:** chip «Guardado en este celular · N por subir» (verde «Nada por subir» cuando todo llegó) y «Paso N de 9» con 9 segmentos: los hechos en tinta, el actual en naranja.
- **Planilla:** los números de todos los miembros en fila; los anotados en tinta con chulo naranja, el de ahora con borde naranja. Se toca para ir a uno. Dice «Anotados N de M».
- **Ficha del miembro:** el número en una ficha de tinta, el nombre corto (solo si autorizó sus datos) y «N de M».
- **Sellos (acciones):** − y + de 68 dp, el número grande, un cuadro sellado por acción comprada (hasta 10) y la cuenta «2 × $ 30.000 = $ 60.000».
- **Contador:** − y + de 56 dp; el «+» en tinta, el «−» en hueco; el número da un saltito al cambiar.
- **Casilla:** cuadro que se llena de tinta con un chulo que cae con resorte; en la asistencia, quien no vino queda tachado.
- **Total:** doble raya del libro, la cifra grande y su valor en letras.
- **Teclado de dinero / PIN:** teclas de 62 / 72 dp en `hueco`; el PIN se escribe con puntos que se llenan; si no coincide, los puntos tiemblan una vez.
- **Billete del arqueo:** el billete con su color real y su valor; detrás se apilan hasta tres si se contaron más. En celulares angostos el billete y su subtotal van arriba y las teclas abajo.
- **Rayas de firma:** dos rayas como en el acta; cuando un cargo firma, su nombre aparece sobre la raya.
- **Sello «Bien contado»:** círculo doble en verde con la ACAP, «BIEN CONTADO» entre dos rayas y la fecha.
- **Estado** (enviar, copia, registro): ícono grande en su tinte, título y qué está pasando.

### Panel (oficina)
- **Barra de secciones:** marca, buscador (Ctrl K), Seguimiento y Gestión; la sección activa es una pestaña de papel con el ícono naranja; Pendientes lleva su cuenta.
- **Buscador (Ctrl K):** ir a cualquier sección o comunidad con el teclado (cmdk sobre el diálogo de Base UI).
- **Cajón lateral:** formulario en una hoja flotante desde la derecha, con el foco atrapado, Escape, y los botones fijos al pie.
- **Selector:** Base UI Select (teclado, búsqueda por letra), se abre desde el campo y marca la elegida; reemplaza todo `<select>` del navegador.
- **Zona de archivo:** soltar o elegir; muestra el archivo con su tamaño, la vista previa si es foto, y deja quitarlo.
- **Confirmar:** diálogo propio (AlertDialog de Base UI) para lo que no se deshace fácil; nunca `confirm()`.
- **Pestañas:** la raya naranja se desliza a la elegida (transición de CSS, interrumpible).
- **Avisos:** Sonner abajo a la derecha para lo que salió bien; los errores van en el formulario.
- **Directorio de personas:** los renglones de la lista de la ACAP, con el número a la izquierda del margen y la cobertura de autorizaciones arriba.

## Superficie nativa (Android)

- **Medidas:** 1 px de este documento = 1 dp. Toques de 56 dp como mínimo; 44 dp con `hitSlop` donde el dibujo es más pequeño.
- **Fuentes:** `AtkinsonHyperlegibleNext-400/600/700/800`, `AtkinsonHyperlegibleMono-400` y `BricolageGrotesque-700/800`, generadas por `npm run fuentes`. Los tokens nativos traen la familia del peso; nunca `fontWeight`.
- **Íconos:** Phosphor (`phosphor-react-native`), cargados uno por uno en `src/ui/iconos.ts` para no meter los 1.500 al APK.
- **Movimiento:** Reanimated 4 y worklets en el hilo de la interfaz; hápticos con `expo-haptics` (`src/ui/tocar.ts`), uno por acción y nunca como única señal.
- **Solo claro, forzado:** `userInterfaceStyle: light`.
- **Teclados propios** para dinero y PIN; el del sistema solo para texto libre (motivos, notas, usuario y clave).
- **Versión nativa:** Reanimated, worklets, hápticos y SVG son módulos nativos: entraron con la 0.2.0 y las actualizaciones de JavaScript de esa versión nunca llegan a un APK 0.1.0.

## Motion

Movimiento que explica, rápido y que se puede interrumpir (Emil Kowalski). Curvas: salida `cubic-bezier(0.23, 1, 0.32, 1)`, mover en pantalla `cubic-bezier(0.77, 0, 0.175, 1)`, cajón `cubic-bezier(0.32, 0.72, 0, 1)`. Nunca `ease-in` en la interfaz, nunca desde escala 0.

| Qué | Cómo | Por qué |
|---|---|---|
| Presionar cualquier cosa | escala 0,97 en 100 ms al apoyar el dedo, vuelve en 180 ms; vibración corta en la app | Respuesta en el instante del toque |
| Pasar al miembro siguiente / anterior | entra 28 dp desde la derecha (o la izquierda) en 200 ms | Se lee como pasar renglones |
| Número de un contador | crece 14 % y vuelve con resorte | Se nota el cambio sin leerlo |
| Sellar una acción | el cuadro cae de 1,3 a 1 en 200 ms | El sello de la libreta |
| PIN que no coincide | los puntos tiemblan una vez + vibración de error | Error sin leer |
| Sello «Bien contado» | cae de 1,5 a 1 en 260 ms, vibración fuerte al tocar el papel y la tinta se corre | El único momento de la marca |
| Cajón del panel | entra en 340 ms con la curva de cajón, sale en 220 ms por el mismo lado | Continuidad espacial |
| Selector, diálogo | escala 0,97 + opacidad en 150–200 ms desde el campo (el diálogo, desde el centro) | Origen claro |
| Página del panel | aparece en 220 ms subiendo 4 px; las cifras se escalonan 40 ms | Evita el salto |
| Navegación, buscador (Ctrl K), filas de tablas | sin animación | Se usan muchas veces al día |

Con «Quitar animaciones» (app) o `prefers-reduced-motion` (web) no hay desplazamientos ni escalas: solo cambios de opacidad y color; el sello aparece quieto.

## Panel de la Fundación: datos

### Formatos de datos

Todo va en es-CO, con pesos enteros y la cifra exacta siempre disponible.
- **`pesosCortos`:** desde 1.000.000 → «$ 97,5 M» (un decimal como máximo); desde 10.000 → «$ 850 mil»; por debajo, el formato exacto «$ 9.500». Los negativos usan el signo menos tipográfico (−).
- **`pesosExactos`:** es `formatearPesos` de `@credimpacto/reglas` («$ 97.512.000»). Va en el `title` de las cifras, en el texto para el lector de pantalla y en los globos de los gráficos.
- **`porcentaje`:** un decimal como máximo, con coma y espacio antes del signo («91,6 %»). Un valor nulo es «Sin datos», nunca «0 %».
- **Meses** en abreviatura minúscula («oct»); **fecha de corte** con día, mes en letras y hora.

### Estados y umbrales

Cada comunidad tiene un estado, que se calcula en el servidor (`backend/acap/tablero.py`):

| Estado | Palabra | Marca | Cuándo |
|---|---|---|---|
| `mora` | En mora | rojo | Más del 10 % de su cartera vencida (`UMBRAL_MORA`) |
| `atencion` | Atención | amarillo | Algo de mora (> 0 %) o datos de hace más de 14 días |
| `sin_datos` | Sin datos | gris de datos | Sin ciclo, nunca sincronizó o no sincroniza hace más de 30 días |
| `al_dia` | Al día | verde | Ninguna de las anteriores |

**Tonos de los indicadores:** índice de mora global más de 10 % = alerta, más de 0 % = atención; mora por zona más de 6 % = alerta, más de 2 % = atención; cumplimiento de pagos menos de 90 % = alerta.

### Gráficos

Recharts con la voz de `_panel/graficoTema.ts`: naranja = ahorro, azul = crédito, tinta = miembros, verde = fondo social; rejilla casi invisible, ejes en `tinta-tenue`, globo de papel con la cifra exacta. Crecen al cargar en 420–450 ms (salvo con reducir movimiento).

## Do's and Don'ts

**Do:**
- Un solo botón naranja por pantalla.
- Preguntar en la app como lo haría una persona de la junta («¿Quién vino hoy?»), una cosa por pantalla.
- Mostrar cada monto en es-CO y, en la app, con su valor en letras.
- Mostrar cada estado con palabra y color (y cifra o ícono cuando lo hay).
- Corregir con tachado y reverso, nunca editando en sitio ni borrando.
- Usar los componentes del kit (`movil/src/ui`, `web/src/app/(fundacion)/fundacion/_panel`): selector, cajón, confirmar, archivo, pestañas, renglón.
- Probar a 320 dp en la app y a 390 px en el panel.

**Don't:**
- No dar a entender que somos un banco: nada de bóvedas, «saldo disponible», «tu cuenta» ni íconos de banco.
- No usar controles del navegador sin diseño (`<select>`, `<input type="file">` visible, `confirm()`).
- No poner tarjetas dentro de tarjetas, ni paredes de tarjetas de KPI.
- No usar texto blanco sobre naranja, ni naranja en lo que no sea la acción, el margen, los sellos o el ahorro.
- No usar el color del billete como único identificador.
- No usar emojis como íconos ni íconos dibujados a mano: Phosphor.
- No animar lo que se usa muchas veces al día.
- No usar modo oscuro.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-06 | Sistema de diseño inicial creado | Creado con /design-consultation a partir del diseño aprobado del MVP (D1–D28) e investigación sobre digitalización de grupos de ahorro y UI para baja alfabetización. |
| 2026-10-06 | Metáfora del cuaderno: renglones, tachado más reverso, sello de cierre | Las juntas ya confían en el cuaderno y el sello. El tachado muestra el libro solo-agregar sin explicar nada. |
| 2026-10-06 | Arqueo con el color real de cada billete | Aprovecha la costumbre de reconocer el billete por su color (pauta CSCW de metáforas culturales). |
| 2026-10-06 | Atkinson Hyperlegible Next con `tnum` para texto y cifras | Distingue los caracteres que se confunden y alinea las cifras. |
| 2026-10-06 | Solo modo claro | La escena de uso es sol y pantallas baratas. |
| 2026-10-07 | Sección "Superficie nativa (Android)" | La reunión y la vista del socio pasaron a app Expo (D2 de alcance). |
| 2026-10-25 | Panel con la marca CoimpactoB (naranja #F66A03, Poppins y Roboto) | Revisión final del panel. Reemplazado el 2026-10-26. |
| 2026-10-26 | Rediseño total: una sola libreta para la app y el panel | El equipo juzgó el diseño anterior genérico («AI slop»): dos mundos visuales mezclados, controles del navegador, tarjetas de plantilla y una app de contadores que no se parecía al cuaderno de la ACAP. Se rehízo todo con las skills de Emil Kowalski y Taste. |
| 2026-10-26 | Bricolage Grotesque reemplaza a Bitter y Poppins en los títulos | Una sola voz de títulos para las dos superficies, con carácter de imprenta y legible en tamaños grandes; Roboto y Poppins se descartan por genéricas. |
| 2026-10-26 | Naranja de marca #F66A03 en todo, con texto tinta | Unifica la app (antes #F07B22) con la marca de la Fundación; tinta sobre naranja da 5,3:1. |
| 2026-10-26 | El margen naranja vuelve, con el número a la izquierda | En 2026-10-06 se descartó por ruido; con 45 % de opacidad y solo en listas de miembros y vacíos se lee como el cuaderno sin chocar con el rojo de rechazado. |
| 2026-10-26 | Acciones como sellos de libreta y planilla de miembros | La libreta VSLA sella una casilla por acción; la planilla muestra quién falta, como la columna del cuaderno. |
| 2026-10-26 | Base UI, Sonner y cmdk en el panel; Reanimated, worklets, hápticos y Phosphor en la app | Componentes accesibles en vez de controles del navegador; movimiento en el hilo de la interfaz y respuesta háptica en celulares de gama baja. |
