---
# gstack: design-md-format=spec
name: Credimpacto
description: El cuaderno de la ACAP hecho pantalla; tinta azul sobre papel blanco, renglones, billetes reales y un sello que dice que el dinero está bien contado.
colors:
  tinta: "#10213D"
  tinta-suave: "#3D4A60"
  navy: "#1B3A6B"
  navy-tinte: "#E4EAF3"
  naranja: "#F07B22"
  naranja-presionado: "#D96A15"
  on-naranja: "#10213D"
  papel: "#FFFFFF"
  papel-oficina: "#F2F4F7"
  renglon: "#D5DCE6"
  renglon-fuerte: "#AEB9C8"
  confirmado: "#124B2E"
  confirmado-tinte: "#E8F4EC"
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
    fontFamily: Bitter
    fontWeight: 700
    fontSize: clamp(2rem, 4vw, 3rem)
    letterSpacing: -0.01em
  heading:
    fontFamily: Bitter
    fontWeight: 600
    fontSize: 1.75rem
  body:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 400
    fontSize: 1.125rem
    lineHeight: 1.5
  body-oficina:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 400
    fontSize: 1rem
    lineHeight: 1.5
  campo-titulo:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 700
    fontSize: 1.625rem
    lineHeight: 1.2
  cifra-clave:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 800
    fontSize: 2.75rem
    lineHeight: 1.1
    fontFeature: tnum
  cifra-renglon:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 700
    fontSize: 1.375rem
    fontFeature: tnum
  label:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 600
    fontSize: 0.875rem
    letterSpacing: 0em
  mono:
    fontFamily: Atkinson Hyperlegible Mono
    fontWeight: 400
    fontSize: 0.875rem
    fontFeature: tnum
rounded:
  sm: 4px
  md: 8px
  lg: 12px
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
    rounded: "{rounded.md}"
    height: "{spacing.toque-min}"
  button-primary-active:
    backgroundColor: "{colors.naranja-presionado}"
  button-secondary:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    borderColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    height: "{spacing.toque-min}"
  button-disabled:
    backgroundColor: "{colors.provisional-tinte}"
    textColor: "{colors.tinta-suave}"
    borderColor: "{colors.renglon-fuerte}"
  tecla:
    backgroundColor: "{colors.papel-oficina}"
    textColor: "{colors.tinta}"
    borderColor: "{colors.renglon-fuerte}"
    rounded: "{rounded.md}"
    height: "{spacing.toque-min}"
  renglon:
    borderColor: "{colors.renglon}"
    height: 64px
  dinero:
    borderColor: "{colors.tinta}"
    rounded: "{rounded.md}"
  estado:
    rounded: "{rounded.sm}"
  billete:
    borderColor: "{colors.renglon-fuerte}"
    rounded: "{rounded.sm}"
  sello:
    borderColor: "{colors.confirmado}"
    textColor: "{colors.confirmado}"
    rounded: "{rounded.sello}"
  sidebar-oficina:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.papel}"
  nav-link-activo:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.navy}"
    rounded: "{rounded.sm}"
---

# Credimpacto

> **Dos mundos, una marca de producto.** Todo lo que sigue hasta la sección «Panel de la Fundación (web, oficina)» es el mundo del **cuaderno de la ACAP**: gobierna la app Android (reunión y vista del socio) y la vista previa del sistema. La web de la Fundación (`/fundacion`) sigue el mundo del **Panel de la Fundación**, documentado en su propia sección; ver allí la tabla de alcance.

## Overview

**Creative North Star:** el cuaderno de la ACAP, en pantalla. Tinta azul sobre papel blanco, un renglón por movimiento, el billete real para contar la caja y un sello para cerrar. Las juntas ya confían en esos objetos. La app se ve como *su* libro, no como un banco, y eso hace visible el principio de que no custodiamos dinero.

**Lo memorable:** «Nuestro dinero está bien contado.» Cada decisión de este documento sirve a esa frase. Las cifras son grandes y están alineadas, nada se borra, la caja se cuenta billete por billete y la reunión termina con un sello.

**Product context:** es el libro contable de los grupos de ahorro y crédito comunitario (ACAP) de la Fundación CoimpactoB, en Colombia: Juntas de Acción Comunal, Consejos Comunitarios étnicos y grupos no formalizados. Tiene dos superficies con una sola marca:
- **Reunión (app Android nativa con Expo, offline).** La usa la junta (Presidente, Registrador, Portador de Caja, Contadores) en un Android de gama baja, al aire libre o en un salón comunal, muchas veces sin señal. Son usuarios con baja alfabetización digital y buena aritmética. Es un asistente de 9 pasos que se maneja con toques.
- **Oficina (web de la Fundación).** La usan Admin, Dirección, coordinadores, facilitadores y analistas, en un portátil. Tiene 5 secciones: Pendientes, ACAP, Personas, Indicadores y Configuración.

**Mode per surface:**
- Reunión: *Operate*. Una tarea por pantalla, cero lectura innecesaria.
- Oficina: *Operate* denso. Tablas, colas de revisión y consolidados.

**Reference sites (investigación de esta consulta):**
- Pilotos de digitalización de grupos de ahorro: https://www.usaidlearninglab.org/community/blog/digitalizing-savings-groups-sierra-leone · https://www.responseinnovationlab.com/updates/learning-from-a-savings-group-digitisation-pilot-in-uganda · https://hivenetwork.online/2020/03/what-makes-vsla-online-different/
- 136 pautas de UI para usuarios con baja alfabetización (CSCW 2021): https://anupriyatuli.github.io/publications/2021_CSCW.pdf
- Pares colombianos: DaviPlata https://apps.apple.com/us/app/daviplata/id1100731780 · comparación con Nequi https://colombiamove.com/blog/nequi-vs-daviplata-comparacion-2026/
- Mockup analítico previo (de él heredamos el azul, el naranja y la serif): https://coimpacto-b.vercel.app
- Vista previa aprobada de este sistema: [docs/designs/preview/sistema-de-diseno.html](docs/designs/preview/sistema-de-diseno.html)

**Key characteristics:**
- Una columna con renglones y sin tarjetas. Parece un cuaderno, no un dashboard.
- Las cifras son lo más grande de la pantalla, siempre con el valor en letras debajo.
- Hay un solo botón naranja por pantalla, y es lo que se hace ahora.
- Siempre se ve si el dato está guardado aquí o ya llegó a la Fundación.
- Errar no da miedo: corregir tacha, no borra.

## Colors

**Strategy:** restrained. El papel es blanco, la tinta azul oscuro y el naranja solo aparece en la acción principal. El color se reserva para cosas que significan algo: el estado de un movimiento y la franja del billete.

**Light or dark:** solo claro, decidido por la escena de uso. La reunión pasa al aire libre o en salones con mucha luz, en pantallas baratas de brillo bajo. Un modo oscuro empeora la lectura al sol y duplica las pruebas de contraste. La oficina también es solo clara, para que sea una sola marca y un solo juego de pruebas. Si algún día se agrega el modo oscuro en la oficina, debe conservar la jerarquía con superficies azul tinta escalonadas, no con una inversión automática.

**Reglas de contraste (verificadas con la fórmula WCAG):**
- Todo texto sobre papel o sobre su tinte llega a ≥ 7:1. Tinta 16:1, tinta suave 9:1, azul 11:1, estados sobre su tinte entre 7,8 y 9:1.
- La única excepción es la etiqueta del botón naranja: tinta sobre naranja da 5,8:1. Se acepta porque la etiqueta va siempre en negrita de 20 px o más, y eso cumple AAA para texto grande (≥ 4,5:1). Nunca hay texto normal sobre naranja.
- Blanco sobre naranja (2,8:1) está prohibido.

**Quién señala qué:**
- `naranja`: la única acción principal de la pantalla, el foco visible (contorno de 3 px) y los contadores de la barra lateral. Nada más.
- `navy`: la marca, los títulos de la oficina, la barra lateral y los enlaces.
- `tinta` / `tinta-suave`: todo el texto. La tinta suave es para lo secundario, nunca para cifras.
- Estados: cada uno tiene un color de texto y un tinte de fondo (ver Components). Van siempre con ícono y palabra.
- Billetes: son el color real de la familia nueva del Banco de la República ($2.000 azul, $5.000 café, $10.000 rojo, $20.000 naranja, $50.000 violeta, $100.000 verde). Solo se usan como franja de 14 px a la izquierda del billete, nunca como fondo de texto, y el número del billete siempre está escrito al lado. La franja del $20.000 es naranja, pero como franja no compite con el botón.

## Typography

Las tres familias vienen de Google Fonts, con licencia OFL y eje de peso variable. Se verificaron en esta consulta (nombre, pesos, licencia y la tabla GSUB con `tnum`).

- **Atkinson Hyperlegible Next** (Braille Institute, Applied Design Works, Letters From Sweden), pesos 200–800. Es la voz de toda la superficie de reunión y del texto de la oficina. Se eligió porque distingue 0/O, 1/l/I, 6/8 y 5/S, que es justo lo que se confunde al leer plata con poca luz o poca vista. Tiene `tnum`, así que todas las cifras se alinean como en una columna de cuaderno.
- **Bitter** (Sol Matas, formada en la UBA), pesos 100–900. Solo se usa en los títulos de la oficina. Es una slab de contraste bajo: hereda la serif del mockup sin caer en la serif de revista, y se lee como el encabezado de un libro de cuentas. **No se usa en la superficie de reunión.**
- **Atkinson Hyperlegible Mono**, pesos 200–800. Solo para códigos, huellas (hash) e identificadores en la oficina. No se usa para dinero: el dinero va en Next con `tnum`, que se lee mejor.

**Carga:** los `.woff2`/`.ttf` variables (latin y latin-ext) con su licencia OFL viven en `packages/tokens`. La web los declara con `@font-face` y el mismo `unicode-range` de Google; la app Android los carga con `expo-font` dentro del binario. Ni el build ni la reunión dependen de Google Fonts.

**Escala:**
- Reunión: cuerpo 18 px mínimo; títulos de paso 26 px/700; cifra en renglón 22 px/700; cifra clave 44 px/800 (mínimo 32 px); valor en letras 18 px.
- Oficina: cuerpo 16 px; títulos Bitter de 28 a 48 px; etiquetas 14 px/600.
- Los niveles se distinguen por tamaño, no solo por peso.

## Layout

- **Reunión:** una columna, con 20 px de margen lateral (16 px como mínimo absoluto). La barra superior lleva el paso y el estado de la red, luego viene la barra de 9 segmentos del asistente y después el contenido. Al final van las acciones, apiladas y de ancho completo. La lista es de renglones de 64 px de alto como mínimo, separados por una línea de 1 px. **Sin tarjetas.** El único recuadro es el componente de dinero, porque es el objeto que se está editando.
- **Oficina:** la barra lateral azul mide 232 px y el contenido es fluido, hasta 1200 px. Debajo de 760 px la barra lateral se vuelve una tira horizontal. Las cifras resumen van en una franja con divisores, no en tarjetas sueltas. Las tablas tienen el encabezado subrayado en tinta, renglones de 1 px y las cifras alineadas a la derecha. Si no caben, la tabla se desplaza sola, nunca la página.
- **Ritmo:** se usa una base de 8 px; dentro de un grupo, `sm`/`md`, y entre secciones, `2xl`/`3xl`.
- **Ruptura intencional:** el sello de cierre se sale de la columna y va girado −8°. Es lo único torcido en todo el sistema.

## Elevation & Depth

Es plano, como el papel. La profundidad se marca con bordes de 1 a 2 px en tinta o en renglón, y con tintes de fondo. No hay sombras en la superficie de reunión. En la oficina solo se permite una sombra en menús desplegables y diálogos, con desplazamiento real (`0 4px 12px rgb(16 33 61 / 0.12)`). Nunca hay halos ni brillos sin desplazamiento.

## Shapes

- `sm` 4 px: estados, billetes, ítems de navegación y firmas.
- `md` 8 px: botones, teclas y el componente de dinero.
- `lg` 12 px: los contenedores grandes de la oficina.
- `sello`: el círculo del sello. Es el único elemento redondo del sistema.
- Para un elemento anidado, el radio interior es el exterior menos el espacio entre ambos. Nunca se usa radio de píldora en botones.

## Components

**Botón principal** (naranja, etiqueta en tinta, 20 px/700, alto ≥ 56 px, ancho completo en campo). Hay uno por pantalla. *Presionado:* `naranja-presionado`. *Foco:* contorno naranja de 3 px con separación de 3 px. *Deshabilitado:* tinte gris, y dice lo que falta («Faltan 2 firmas»), nunca un botón gris mudo.

**Botón secundario** (papel con borde de tinta de 2 px). Para «Corregir», «Contar monedas» y similares. **Fantasma:** texto azul subrayado, solo para acciones de consulta («Ver el cuaderno»).

**Dinero** (el componente central, en TypeScript): muestra quién y qué arriba («Aporte de María Cuesta»), la cifra clave con formato es-CO (`$ 250.000`, con espacio no separable), el valor en letras debajo («doscientos cincuenta mil pesos») y el teclado numérico de 56 px con atajo `000`. Si el monto es 5 veces o más lo usual de esa persona, aparece debajo un aviso en tinte `por-validar` con ícono: «Es 5 veces lo que María aporta siempre ($ 50.000). ¿Está bien?». El aviso no bloquea. Los montos son pesos enteros, nunca decimales.

**Renglón del libro:** nombre a la izquierda y cifra a la derecha (22 px, `tnum`). La línea de detalle de abajo lleva el estado y las notas. Variantes:
- *Faltante:* tinta suave, con «sin aporte» en vez de cifra.
- *Tachado:* tachado de 2 px en nombre y cifra, con el motivo escrito debajo («Tachado por el Registrador: «sobraba un cero»»).
- *Reverso:* va inmediatamente debajo del tachado, con la cifra en negativo y en `rechazado`.

Corregir nunca borra, porque el libro es solo-agregar y la pantalla lo muestra así.

**Estado** (tabla fija; el color nunca va solo):

| Estado (sistema) | Palabra en pantalla | Ícono | Frase para la junta |
|---|---|---|---|
| provisional | Guardado aquí | reloj | Está en este celular. Se envía cuando haya señal. |
| confirmado | Confirmado | chulo | La Fundación ya lo tiene. Está en el libro. |
| por_validar | Por revisar | ojo | Una persona de la Fundación lo va a mirar. |
| con_observaciones | Con nota | globo de texto | Está en el libro, con un comentario para la junta. |
| en_conflicto | Hay que aclarar | triángulo | Depende de algo que se rechazó. La junta lo revisa. |
| rechazado | Rechazado | equis | No entró al libro. Dice por qué y qué hacer. |

Los íconos son de trazo de 2,4 px, de 22 px en campo y 18 px en tablas. La etiqueta va en negrita, con radio `sm`.

**Arqueo con billetes:** hay una fila por denominación. Lleva la franja del color real, el número en 22 px/800 con el nombre del color debajo, y el contador `− n +` con botones de 56 px. Es a ciegas: no muestra cuánto debería haber hasta que se toca «Terminé de contar». Debajo va el total con doble línea de tinta, la cifra de 34 px y el valor en letras. Las monedas van en otro paso con la misma mecánica.

**Barra de red** (en la cabecera, siempre visible): «Sin señal · guardando aquí», con ícono de antena tachada, o «Enviado a la Fundación». Nunca un spinner sin palabras.

**Firmas:** hay una fila por firmante, con nombre, cargo y estado («Firmó» en `confirmado`, o «Falta firmar»). Dos firmas no pueden ser del mismo cargo; si pasa, la fila lo dice en `rechazado`.

**Sello «Bien contado»:** es un círculo de 200 px con borde doble en `confirmado`, el texto «BIEN CONTADO», el nombre de la ACAP y la fecha, girado −8°. Aparece solo cuando la reunión se cierra con las firmas completas.

**Oficina:**
- Barra lateral azul; el ítem activo va en papel con texto azul y el contador de pendientes en naranja.
- Franja de cifras con divisores.
- Tabla con códigos en Mono y diferencias de caja alineadas a la derecha.
- Hay un solo botón naranja por vista (la primera fila de la cola); el resto son secundarios.

**Estados vacíos, de carga y de error (obligatorios en cada componente):**
- *Vacío:* dice qué hacer («Todavía no hay aportes. Toque el nombre de la primera socia.»).
- *Carga:* esqueleto de renglones, nunca un spinner a pantalla completa en campo.
- *Error:* dice qué pasó y qué hacer, y nunca culpa a la persona.
- *Contenido largo:* los nombres largos pasan a la línea siguiente; las cifras no se parten nunca (`white-space: nowrap`).

## Superficie nativa (Android)

La reunión y la vista del socio corren en una app Expo para Android. Esta sección traduce el sistema a la app; los tokens son los mismos (`packages/tokens` genera CSS para la web y un módulo TS para React Native desde el YAML de arriba).

- **Medidas:** 1 px de este documento = 1 dp en Android. Los toques de 56 px son 56 dp; los textos en px se aplican como tamaño de fuente en dp, con la escala del sistema según la sección de accesibilidad del plan (N10).
- **Fuentes:** Atkinson Hyperlegible Next, Mono y Bitter incluidas en el APK con `expo-font`, un .ttf estático por peso (`Bitter-700`, `AtkinsonHyperlegibleNext-400`…) generado desde los mismos .woff2 de la web; los tokens nativos ya traen la familia del peso, sin `fontWeight`. Nunca la fuente del sistema como voz principal. Las cifras usan `fontVariant: ['tabular-nums']`.
- **Solo claro, forzado:** la app ignora el modo oscuro del sistema y el oscuro forzado de Android 10+ (`userInterfaceStyle: light`, sin permitir inversión). La barra de estado y la de navegación van en {colors.papel} con íconos oscuros.
- **Teclado:** dinero y PIN usan siempre el teclado propio (componente `tecla`, 56 dp, atajo `000`); nunca el teclado del sistema, que trae sugerencias, tapa la pantalla y cambia el diseño. El teclado del sistema solo aparece para motivos en texto libre, y la pantalla se acomoda al abrirse.
- **Ícono y arranque:** ícono adaptativo y monocromático de un cuaderno con renglones y el sello ({colors.tinta} sobre {colors.papel}); arranque en {colors.papel} con el sello pequeño y renglones de espera mientras abre la base cifrada.
- **Movimiento:** las mismas duraciones y curvas de la sección Motion; el sello usa el mismo momento (escala 1,25 → 1 en 320 ms) con vibración háptica corta; con "Quitar animaciones" de Android, sin animación.

## Do's and Don'ts

**Do:**
- Usar un solo botón naranja por pantalla.
- Mostrar cada monto de dinero en es-CO, con espacio no separable y el valor en letras debajo (en campo).
- Mostrar cada estado con ícono, palabra y color, sacados de la tabla fija.
- Cumplir los mínimos en campo: texto ≥ 18 px, cifras clave ≥ 32 px, toques ≥ 56 px y contraste ≥ 7:1.
- Mostrar las correcciones como tachado más reverso, nunca como edición en sitio ni borrado.

**Don't:**
- No dar a entender que somos un banco: nada de bóvedas, «saldo disponible», «tu cuenta» ni íconos de banco. El dinero es del grupo y lo tiene la caja o la entidad aliada.
- No poner tarjetas dentro de tarjetas ni dashboards de tarjetas en la superficie de reunión.
- No poner texto blanco sobre naranja, ni naranja en algo que no sea la acción principal.
- No usar el color del billete como único identificador, ni como fondo de texto.
- No poner gráficos decorativos, anillos de progreso ni avatares falsos en campo. Si una cifra importa, se muestra la cifra.
- No usar emojis como íconos.
- No usar modo oscuro.

## Motion

- **Approach:** mínimo y funcional. Solo hay transiciones que ayudan a entender, porque los celulares de campo son lentos y la batería importa.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)
- **Usos:** el paso del asistente se desliza en 200 ms, el renglón nuevo aparece en 150 ms y el tachado se dibuja de izquierda a derecha en 250 ms.
- **The one authored moment:** el sello «Bien contado» cae sobre la página al cerrar la reunión. Va de escala 1,25 a 1 con opacidad, en 320 ms, con `cubic-bezier(.2,.8,.2,1)`, sin rebote y con una vibración de 40 ms. Con `prefers-reduced-motion`, el sello aparece sin animación.

## Panel de la Fundación (web, oficina)

Este es el segundo mundo visual del proyecto. Se registró a partir de lo que se construyó y se aprobó en la revisión final (veredicto: *ship*). La fuente es `web/src/app/(fundacion)/fundacion/layout.tsx`, `panel.module.css`, `page.tsx` y la carpeta `_panel/`. Aquí se documenta lo que existe en el código, no lo que se planeó.

### Alcance: qué mundo gobierna cada superficie

| Superficie | Mundo | Fuente de los tokens |
|---|---|---|
| App Android (reunión de la junta, vista del socio) | Cuaderno de la ACAP (todo lo anterior a esta sección) | Bloque YAML de este archivo → `packages/tokens` |
| Vista previa `docs/designs/preview/sistema-de-diseno.html` | Cuaderno de la ACAP | Bloque YAML |
| Web `/fundacion`: armazón (barra lateral y marca), Panel de gerencia y secciones de análisis (Ahorro, Crédito, Cartera, Proyectos, Capacitaciones, Análisis, Evaluaciones, Reportes) | **Panel de la Fundación** (esta sección) | Variables de `.panel` en `panel.module.css` |
| Web `/fundacion`: páginas de gestión (Pendientes, Por aclarar, Personas, Celulares, Entrar) | Hoy siguen con los tokens de la «Oficina» del cuaderno (azul, Bitter, Atkinson) dentro del armazón del Panel | `oficina.module.css` + `packages/tokens` |

Las páginas de gestión mezclan los dos mundos, y eso es una deriva sin resolver, no una regla. El equipo decide si se migran al Panel. Mientras no lo decida, una pantalla nueva de `/fundacion` sigue al Panel.

**Por qué los tokens del Panel no están en el bloque YAML:** el bloque YAML genera `packages/tokens` (CSS y React Native) y CI exige que esa salida coincida. Poppins y Roboto no forman parte de ese paquete; el Panel las carga con `next/font`. Por eso la fuente normativa del Panel son las variables CSS de `.panel` en `panel.module.css`, y los valores de abajo se copiaron de ahí. El sidecar `.impeccable/design.json` las guarda con el prefijo `panel-`.

### Overview

**Creative North Star: «El pulso de las comunidades».** El panel se lee como el estado de salud de cada comunidad, no como una pared de tarjetas de métricas. Gerencia entiende en segundos cuánto ahorran y prestan las comunidades, cuáles están al día y cuáles necesitan una visita, y desde ahí entra a la comunidad para actuar.

Es la marca CoimpactoB (coimpactob.com) en modo *Operate*: barra lateral carbón, fondo casi blanco, superficies blancas con borde fino y un solo naranja. La paleta secundaria de la marca existe solo para datos y estados. La densidad es de oficina, para un portátil de día: filas de 44 px y cifras grandes únicamente en la franja principal.

**Key Characteristics:**
- Una franja de cuatro cifras con divisores, sin cajas de color.
- Los estados van siempre con color, palabra y cifra; el color nunca va solo.
- El naranja marca el ahorro, la selección y la acción principal. Nada más.
- Todo dato viene del servidor. Si un bloque no tiene datos, lo dice y explica qué falta.
- El movimiento es corto (menos de 300 ms), usa una curva propia y se apaga con «reducir movimiento».

### Colors

Neutros cálidos de carbón y piedra, un acento naranja de marca y cuatro colores secundarios que solo se usan para datos.

**Primario**
- **Naranja CoimpactoB** (`--naranja` #F66A03): la serie de ahorro en los gráficos y su marca cuadrada, la «i» del logo, el ícono del ítem activo, el contador de pendientes, el anillo de foco y el subrayado de los enlaces de texto. También es el fondo del único botón principal de cada vista.
- **Naranja presionado** (`--naranja-hover` #E05F00): el hover del botón principal.
- **Naranja suave** (`--naranja-suave` #FFF1E6): el fondo de la selección de texto. El ítem activo de la barra usa el naranja al 16 % sobre carbón (`rgb(246 106 3 / 0.16)`).

**Secundarios (solo datos y estados)**
- **Azul CoimpactoB** (`--azul` #005FC5): la serie de crédito en los gráficos.
- **Verde** (`--verde` #35A472): la marca de «Al día», el ícono de hallazgo positivo y la barra de cumplimiento por zona. Su tinte es `--verde-suave` #E8F5EE.
- **Amarillo** (`--amarillo` #F9C032): la marca de «Atención». Su tinte es `--amarillo-suave` #FEF6E1. **Nunca se usa como color de texto.**
- **Rojo** (`--rojo` #F53D45): la marca de «En mora» y el ícono de hallazgo de alerta. Su tinte es `--rojo-suave` #FEECEC. **Nunca se usa como color de texto.**
- **Gris de datos** (`--gris-datos` #C9C7C1): la marca de «Sin datos» y la barra «Falta para la meta».

**Texto de estado** (versiones oscuras para letra, todas ≥ 4,5:1 sobre blanco)
- **Verde texto** (#227A52, 5,3:1): «bien», «sube» y la mora baja.
- **Ámbar texto** (#8A5A00, 5,9:1): «Atención» y la mora media.
- **Rojo texto** (`--rojo-texto` #C4202A, 5,8:1): «En mora», «baja» y la mora alta.

**Neutros**
- **Carbón** (`--carbon` #1C1C1C): la barra lateral. **Carbón 2** (`--carbon-2` #2A2A2A): el hover y los divisores dentro de la barra.
- **Texto** (`--texto` #252525): todo el texto principal y la serie de miembros en los gráficos.
- **Texto suave** (`--texto-suave` #5F5E5A): subtítulos, etiquetas y detalles.
- **Texto tenue** (`--texto-tenue` #6B6A66): las variaciones neutras, los ejes de los gráficos y los controles deshabilitados.
- **Fondo** (`--fondo` #FAFAF9): el lienzo de la página. **Superficie** (`--superficie` #FFFFFF): los bloques.
- **Borde** (`--borde` #ECEBE8): los bordes de bloque, los divisores y la cuadrícula de los gráficos. **Borde fuerte** (`--borde-fuerte` #DAD8D3): los bordes de los controles.
- Dentro de la barra carbón, el texto va en #D9D7D2, el ítem activo y el hover en blanco, y las etiquetas de grupo en #A3A19B.

**The Una Sola Voz Rule.** El naranja aparece en un solo botón por vista. En los datos, el naranja siempre significa ahorro: ninguna otra serie lo usa.

**The Color Con Palabra Rule.** Los colores secundarios se usan como marca (un cuadrado de 8 px), serie o barra. La letra de estado usa la versión oscura de su tono y siempre trae la palabra al lado.

### Typography

**Fuente de títulos:** Poppins (500, 600, 700), cargada con `next/font`. Variable `--fuente-titulos`, con `system-ui` de respaldo.
**Fuente de texto:** Roboto (400, 500, 700). Variable `--fuente-texto`, con `system-ui` de respaldo.

**Carácter:** Poppins, geométrica y redonda, lleva la voz de la marca en los títulos y las cifras grandes. Roboto, neutra, lleva las tablas y el texto. Todo el panel activa `font-feature-settings: "tnum"`, así que las cifras se alinean en columna.

**Jerarquía**
- **Cifra destacada** (Poppins 700, 2,5 rem, −0,03 em, 1,1): solo el «Ahorro del ciclo».
- **Título de página** (Poppins 700, 2 rem, −0,02 em, 1,2).
- **Cifra** (Poppins 600, 2 rem, −0,02 em, 1,1, `tabular-nums`, sin partirse): las otras tres cifras principales.
- **Marca** (Poppins 700, 1,375 rem, −0,02 em): «Credimpacto», con la «i» en naranja.
- **Título de bloque** (Poppins 600, 1,0625 rem, −0,01 em): «Para mirar hoy», «Pulso de las comunidades» y los títulos de los gráficos.
- **Texto** (Roboto 400, 0,9375–1 rem): subtítulos, hallazgos (interlineado 1,45), enlaces de la barra y tabla de zonas.
- **Etiqueta** (Roboto 400–500, 0,875 rem, en `--texto-suave`): nombres de cifras e indicadores, detalles.
- **Pequeño** (Roboto 400–700, 0,8125 rem): chips, filtros, leyendas, pies de cifra y encabezados de tabla.
- **Mínimo** (Roboto 500–700, 0,75 rem): las etiquetas de grupo de la barra y el contador.

Debajo de 520 px, la cifra pasa a 1,5 rem y la destacada a 2,25 rem.

**The Poppins Para Cifras Rule.** Poppins solo va en títulos, en la marca y en las cifras de la franja principal. Los montos de las tablas, filas y gráficos van en Roboto con `tnum`.

### Layout

- **Armazón:** una cuadrícula de dos columnas, con la barra lateral de 232 px fija a la altura de la ventana y el contenido fluido. La página llega hasta 1360 px, con relleno de 32/40/56 px (arriba, lados, abajo).
- **Orden del tablero:** cabecera (título y «Datos al …») → franja de cifras → indicadores → «Para mirar hoy» a todo el ancho → Pulso → gráficos en dos columnas.
- **Franja de cifras:** cuatro columnas `1,35fr 1fr 1fr 1fr` dentro de un solo bloque, separadas por divisores de 1 px. Cada cifra lleva 22/24 px de relleno.
- **Indicadores:** cuatro columnas sin caja, con divisores verticales.
- **Ritmo:** 20 px entre bloques, 28 px después de la cabecera y de los indicadores, y 20/22 px de relleno dentro de cada bloque.
- **≤ 1180 px:** los gráficos pasan a una columna.
- **≤ 900 px:** la barra lateral sube y se vuelve una tira horizontal que se desplaza por su cuenta (sin etiquetas de grupo y sin pie de usuario). El relleno de la página baja a 24/16/40 px, y las cifras y los indicadores pasan a dos columnas.
- **≤ 520 px:** la cifra destacada ocupa todo el ancho y las otras tres quedan en dos columnas. La fila del Pulso queda en nombre + estado, con el detalle debajo y sin el ahorro.
- **≤ 340 px:** cifras e indicadores en una columna.
- Los nombres largos se cortan con puntos suspensivos; las cifras nunca se parten (`nowrap`).

### Elevation & Depth

Es casi plano. Los bloques blancos se separan del fondo #FAFAF9 con un borde de 1 px y una sombra baja que sí tiene desplazamiento. No hay halos.

- **Bloque** (`--sombra`: `0 1px 2px rgb(28 28 28 / 0.04), 0 4px 16px rgb(28 28 28 / 0.04)`): la franja de cifras, «Para mirar hoy», el Pulso y los gráficos.
- **Globo del gráfico** (`0 4px 16px rgb(28 28 28 / 0.1)`): el tooltip, que es lo único que flota.
- Los estados vacío y de error van con borde y sin sombra.

### Shapes

- `--radio` 14 px: bloques, estados vacío y de error, y esqueletos.
- 10 px: el globo del gráfico y el fondo del gráfico vacío.
- `--radio-sm` 8 px: ítems de la barra, filas del Pulso y botones.
- Píldora (999 px): filtros, chips, el contador y las iniciales del usuario.
- 2–3 px: las marcas de estado (8 px) y de leyenda (10 px), y la barra de cumplimiento (6 px de alto).
- Barras de gráfico con 4 px de radio solo en el extremo libre.

### Components

**Barra lateral.** Fondo carbón, marca arriba y dos grupos: «Análisis» (9 secciones) y «Gestión». Cada ítem tiene un ícono Phosphor de 20 px y mide 40 px de alto como mínimo. *Hover* (solo con puntero fino): fondo carbón 2. *Activo* (`aria-current="page"`): naranja al 16 % sobre carbón, texto blanco 500 y el ícono en naranja relleno. El contador de pendientes es una píldora naranja. Abajo van las iniciales, el usuario y un botón para salir.

**Cifras.** Las cuatro cifras principales en una sola franja (`dl`). Cada una lleva etiqueta, cifra en `pesosCortos` (la cifra exacta va en `title` y en texto para el lector de pantalla) y un pie con la variación: flecha y porcentaje en verde texto si sube, en rojo texto si baja, o texto tenue si no hay comparación. «Ahorro del ciclo» es la cifra destacada, con la marca cuadrada naranja.

**Indicadores.** Cuatro pares de etiqueta y valor en negrita de 1 rem, sin caja. El tono del valor sale de los umbrales (ver Estados). Un módulo que aún no existe dice «Módulo en preparación» en peso 500, nunca muestra una cifra inventada.

**Para mirar hoy.** Un bloque a todo el ancho con 2 o 3 hallazgos en frases cortas, en una cuadrícula `auto-fit` de 260 px como mínimo. Cada hallazgo lleva un ícono relleno de 20 px (alerta en rojo, bien en verde, neutro en tenue), el texto en 0,9375 rem y, si aplica, «Ver comunidad», subrayado en naranja. Si no hay hallazgos dice «Nada fuera de lo normal en las comunidades con datos».

**Pulso de las comunidades.** Es el gesto característico del panel.
- *Filtros:* una píldora por estado en orden mora → atención → sin datos → al día, con su marca, su palabra y su cuenta en negrita. Al presionarla se invierte (fondo de texto y letra blanca) y queda en `aria-pressed`. Se deshabilita si la cuenta es 0.
- *Filas de atención:* las comunidades que no están al día, ordenadas por estado y luego por nombre. Es una cuadrícula de `nombre | estado (120 px) | detalle | ahorro (140 px)` con 44 px de alto como mínimo, separadas por renglones de 1 px y sin cajas. El estado va en negrita de 0,8125 rem con su marca y su color de texto. El detalle explica el porqué («14,8 % de la cartera en mora», «Sin datos hace 41 días», «Nunca ha sincronizado»). La fila cierra con el ahorro, como «$ 5,3 M ahorrados». La fila entera es un enlace a la comunidad.
- *Chips de «Al día»:* debajo, con el título «Al día» y su cuenta, va una franja de píldoras de 30 px con la marca verde y el nombre. El ahorro va en el `title`.

**Tabla de zonas («Desempeño por zona»).** Una lista ordenada por cumplimiento, de mayor a menor. La primera columna lleva la zona y «n comunidades» debajo. La segunda, el cumplimiento como barra verde de 6 px sobre 100 % y la cifra en negrita. La tercera, la mora alineada a la derecha y con su tono. Las dos medidas no comparten eje. Las ACAP «Sin zona» no se muestran; si ninguna tiene zona, el estado vacío pide asignarla en Configuración.

**Gráficos** (Recharts, cada uno en una `figure` con título y subtítulo, leyenda propia con cuadrados de 10 px, lienzo de 240 px como mínimo, cuadrícula #ECEBE8 en un solo sentido, ejes sin línea en 12 px tenue y tooltip propio con la cifra exacta):
- *Crecimiento de los últimos 6 meses:* áreas acumuladas. El ahorro va en naranja, con un relleno degradado del 18 % al 0 %; el crédito, en azul y sin relleno.
- *Comunidades con más ahorro:* barras horizontales apiladas, con el ahorro en naranja y lo que falta para la meta en gris de datos.
- *Nuevos miembros y créditos:* barras agrupadas, con los miembros en carbón (#252525) y los créditos en azul.
- Cada gráfico sin datos muestra un recuadro #F7F6F4 con una frase que dice cuándo aparecerá.

**Botones.** Ambos miden 40 px de alto como mínimo, con 16 px de relleno lateral, radio de 8 px y peso 500. *Principal:* fondo naranja, con hover en naranja presionado; hay uno por vista y solo cuando hay una acción que dar (por ejemplo, «Crear la primera ACAP» en el panel vacío). *Secundario:* superficie blanca con borde fuerte, y el borde pasa a tenue en hover. Al presionar cualquiera, escala 0,97.

**Foco y selección.** Todo elemento enfocable muestra un contorno naranja de 2 px, separado 2 px y con radio de 6 px. La selección de texto usa el naranja suave.

**Estados de carga, vacío y error.** *Carga:* un esqueleto con la forma del tablero (cuatro cifras, un bloque y dos gráficos) y un brillo de 1,2 s que se apaga con «reducir movimiento». *Vacío:* un bloque de 560 px como máximo que dice qué falta y qué hacer. *Error:* dice qué pasó, trae «Intentar de nuevo» como botón secundario y lleva `role="alert"`. Las secciones sin módulo (`EnConstruccion`) dicen qué van a mostrar y de dónde saldrá el dato, sin cifras de ejemplo.

### Formatos de datos

Todo va en es-CO, con pesos enteros y la cifra exacta siempre disponible.
- **`pesosCortos`:** desde 1.000.000 → «$ 97,5 M» (un decimal como máximo); desde 10.000 → «$ 850 mil» (redondeado a miles); por debajo, el formato exacto «$ 9.500». Los negativos usan el signo menos tipográfico (−).
- **`pesosExactos`:** es `formatearPesos` de `@credimpacto/reglas` («$ 97.512.000»). Se usa en el `title` de las cifras, en el texto para el lector de pantalla y en los tooltips de los gráficos.
- **`porcentaje`:** un decimal como máximo, con coma y un espacio antes del signo («91,6 %»). Un valor nulo se muestra como «Sin datos», nunca como «0 %».
- **Meses** en abreviatura minúscula («oct»); **fecha de corte** con día, mes en letras y hora («25 de octubre a las 09:32 a. m.»).

### Estados y umbrales

Cada comunidad tiene un estado, que se calcula en el servidor (`backend/acap/tablero.py`):

| Estado | Palabra | Marca | Letra | Cuándo |
|---|---|---|---|---|
| `mora` | En mora | rojo | rojo texto | Más del 10 % de su cartera vencida (`UMBRAL_MORA`) |
| `atencion` | Atención | amarillo | ámbar texto | Algo de mora (> 0 %) o datos de hace más de 14 días |
| `sin_datos` | Sin datos | gris de datos | texto suave | Sin ciclo, nunca sincronizó o no sincroniza hace más de 30 días |
| `al_dia` | Al día | verde | (chip) | Ninguna de las anteriores |

**Tonos de los indicadores** (`bien` verde texto, `atencion` ámbar texto, `alerta` rojo texto):
- *Índice de mora global:* más de 10 % = alerta; más de 0 % = atención; 0 % = bien.
- *Mora por zona:* más de 6 % = alerta; más de 2 % = atención; 2 % o menos = bien.
- *Cumplimiento de pagos:* menos de 90 % = alerta; si no, bien.

Los umbrales por zona son más bajos que el global a propósito: una zona agrupa varias comunidades, así que 6 % ya significa varias en problemas.

### Movimiento

- **Curva:** `--curva` = `cubic-bezier(0.23, 1, 0.32, 1)`, una salida rápida que frena suave. Se usa en todo lo que se mueve o escala.
- **Duración:** menos de 300 ms en toda la interfaz. Los cambios de color en hover duran 160 ms (`ease`) y la escala al presionar, 140 ms (0,95 en el botón de salir, 0,97 en botones y filtros, 0,98 en filas y chips).
- **Entrada de las cifras:** ocurre una sola vez al cargar. Van de opacidad 0,4 y 4 px abajo a su lugar, en 260 ms y escalonadas cada 30 ms. Parten de un estado ya visible.
- **Reacomodo del Pulso** (el momento del panel): al filtrar, lo que sale se desvanece (opacidad y escala 0,98, o 0,96 en los chips) y lo que queda se desliza a su lugar con Motion `layout`, en 240 ms con la curva.
- **Hover** solo con `(hover: hover) and (pointer: fine)`. Lo que se usa a cada rato (la navegación) no se anima, solo cambia de color.
- **Reducir movimiento:** con `prefers-reduced-motion`, el Pulso pasa a duración 0 y sin `layout`, las cifras no entran animadas, los gráficos se dibujan sin animación y el esqueleto no brilla.
- *Divergencia actual:* los gráficos se dibujan en 450 ms, `ease-out`, escalonados a 0/120/240 ms, por encima de la regla de 300 ms. Queda registrado como algo que el código hace, no como modelo para componentes nuevos.

### Do's and Don'ts

**Do:**
- Usar un solo botón naranja por vista y el naranja como el color del ahorro en todos los datos.
- Mostrar cada estado con marca de color, palabra y, cuando la hay, cifra.
- Mostrar el dinero con `pesosCortos` y dejar la cifra exacta en `title`, en el lector de pantalla y en el tooltip.
- Decir qué falta en todo bloque sin datos, sin cifras de ejemplo.
- Usar `--curva`, menos de 300 ms y desactivar con «reducir movimiento».

**Don't:**
- No usar el amarillo ni el rojo de marca como color de letra (no llegan a 4,5:1); para eso están ámbar texto y rojo texto.
- No pintar en naranja otra serie que no sea el ahorro, ni poner un segundo botón naranja.
- No armar una pared de tarjetas de KPI: las cifras van en una franja con divisores y los indicadores, sin caja.
- No poner un control inerte (por ejemplo, un selector de periodo que el servidor todavía no recibe).
- No mostrar «0 %» cuando el dato no existe; se dice «Sin datos».

### Defectos conocidos (no son reglas)

El código actual tiene estos defectos. No se copian en pantallas nuevas:
- Corregido el 2026-10-25: el botón principal, el contador de pendientes y las iniciales llevan letra carbón #1C1C1C sobre naranja (6,3:1); nunca blanca (3,2:1). Todo el ámbar de texto es #8A5A00.
- Los tonos de texto de estado (#227A52, #8A5A00) están escritos a mano y no son variables de `.panel`.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-06 | Sistema de diseño inicial creado | Creado con /design-consultation a partir del diseño aprobado del MVP (D1–D28), investigación sobre digitalización de grupos de ahorro y UI para baja alfabetización, y una propuesta independiente de un subagente de Claude (Codex no está instalado). |
| 2026-10-06 | Metáfora del cuaderno: renglones, tachado más reverso, sello de cierre | Las juntas ya confían en el cuaderno y el sello. El tachado muestra el libro solo-agregar sin explicar nada. El subagente propuso de forma independiente el cuaderno y el tachado; se adoptaron los renglones, sin cuadrícula de fondo ni margen rojo (ruido en pantallas baratas y choque con el rojo de rechazado). |
| 2026-10-06 | Arqueo con el color real de cada billete | Aprovecha la buena aritmética y la costumbre de reconocer el billete por su color (pauta CSCW de metáforas culturales). Colores confirmados contra fuentes de la familia nueva. El subagente llegó a la misma idea por su cuenta. |
| 2026-10-06 | Atkinson Hyperlegible Next para toda la superficie de reunión, con `tnum` | Distingue los caracteres que se confunden y tiene cifras tabulares, verificadas en el archivo. Las dos voces coincidieron. Se descartó Mono para dinero porque es más ancha y se lee peor. |
| 2026-10-06 | Bitter (en vez de Bespoke Slab) para los títulos de la oficina | Hereda la serif del mockup con contraste bajo. Está verificada en Google Fonts (OFL) y la diseñó una diseñadora latinoamericana. Bespoke Slab, propuesta del subagente, no se verificó en esta sesión. |
| 2026-10-06 | Solo modo claro | La escena de uso es sol y pantallas baratas (D del diseño aprobado). La vista previa trae un simulador de «celular barato al sol» en lugar del interruptor de modo oscuro. |
| 2026-10-07 | Sección "Superficie nativa (Android)" | La reunión y la vista del socio pasaron a app Expo (D2 de alcance); N9 de la revisión de diseño nativo. |
| 2026-10-06 | Excepción de contraste en el botón naranja: 5,8:1 | La etiqueta va siempre en negrita de 20 px o más, que es AAA para texto grande. Se conserva el naranja de marca. |
| 2026-10-25 | Sección «Panel de la Fundación (web, oficina)» | Se registró desde el código del panel aprobado en la revisión final (marca CoimpactoB: naranja #F66A03, carbón, Poppins y Roboto). El cuaderno sigue rigiendo la app y la vista previa. Los tokens del Panel viven en `panel.module.css` y no en el YAML, para no alterar `packages/tokens` ni su verificación en CI. |
