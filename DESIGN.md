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

## Overview

**Creative North Star:** el cuaderno de la ACAP, en pantalla. Tinta azul sobre papel blanco, un renglón por movimiento, el billete real para contar la caja y un sello para cerrar. Las juntas ya confían en esos objetos. La app se ve como *su* libro, no como un banco, y eso hace visible el principio de que no custodiamos dinero.

**Lo memorable:** «Nuestro dinero está bien contado.» Cada decisión de este documento sirve a esa frase. Las cifras son grandes y están alineadas, nada se borra, la caja se cuenta billete por billete y la reunión termina con un sello.

**Product context:** es el libro contable de los grupos de ahorro y crédito comunitario (ACAP) de la Fundación CoimpactoB, en Colombia: Juntas de Acción Comunal, Consejos Comunitarios étnicos y grupos no formalizados. Tiene dos superficies con una sola marca:
- **Reunión (PWA de campo, offline).** La usa la junta (Presidente, Registrador, Portador de Caja, Contadores) en un Android de gama baja, al aire libre o en un salón comunal, muchas veces sin señal. Son usuarios con baja alfabetización digital y buena aritmética. Es un asistente de 9 pasos que se maneja con toques.
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

**Carga:** se publica un solo `<link>` a `fonts.googleapis.com/css2` con `display=swap`, y estos pesos: Next 400/600/700/800, Bitter 600/700, Mono 400. En la PWA, el service worker guarda las fuentes en caché en la primera visita para que funcionen sin señal. Al montar el monorepo conviene pasarlas a `next/font` (autoalojadas), así no depende de Google en campo.

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

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-06 | Sistema de diseño inicial creado | Creado con /design-consultation a partir del diseño aprobado del MVP (D1–D28), investigación sobre digitalización de grupos de ahorro y UI para baja alfabetización, y una propuesta independiente de un subagente de Claude (Codex no está instalado). |
| 2026-10-06 | Metáfora del cuaderno: renglones, tachado más reverso, sello de cierre | Las juntas ya confían en el cuaderno y el sello. El tachado muestra el libro solo-agregar sin explicar nada. El subagente propuso de forma independiente el cuaderno y el tachado; se adoptaron los renglones, sin cuadrícula de fondo ni margen rojo (ruido en pantallas baratas y choque con el rojo de rechazado). |
| 2026-10-06 | Arqueo con el color real de cada billete | Aprovecha la buena aritmética y la costumbre de reconocer el billete por su color (pauta CSCW de metáforas culturales). Colores confirmados contra fuentes de la familia nueva. El subagente llegó a la misma idea por su cuenta. |
| 2026-10-06 | Atkinson Hyperlegible Next para toda la superficie de reunión, con `tnum` | Distingue los caracteres que se confunden y tiene cifras tabulares, verificadas en el archivo. Las dos voces coincidieron. Se descartó Mono para dinero porque es más ancha y se lee peor. |
| 2026-10-06 | Bitter (en vez de Bespoke Slab) para los títulos de la oficina | Hereda la serif del mockup con contraste bajo. Está verificada en Google Fonts (OFL) y la diseñó una diseñadora latinoamericana. Bespoke Slab, propuesta del subagente, no se verificó en esta sesión. |
| 2026-10-06 | Solo modo claro | La escena de uso es sol y pantallas baratas (D del diseño aprobado). La vista previa trae un simulador de «celular barato al sol» en lugar del interruptor de modo oscuro. |
| 2026-10-06 | Excepción de contraste en el botón naranja: 5,8:1 | La etiqueta va siempre en negrita de 20 px o más, que es AAA para texto grande. Se conserva el naranja de marca. |
