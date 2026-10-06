# Product

<!-- impeccable:product-schema 1 -->

> Escrito el 2026-10-06 por `/impeccable init` a partir del diseño aprobado ([docs/designs/credimpacto-mvp-libro-contable.md](docs/designs/credimpacto-mvp-libro-contable.md)) y de CLAUDE.md. El usuario delegó las decisiones de esta tarea mientras estaba fuera, así que no hubo entrevista en vivo. Todo lo de aquí sale de esas fuentes ya aprobadas; lo que sigue abierto está marcado **Por decidir**. Revisar al volver.

## Platform

web

(La superficie de reunión es una PWA offline-first, instalable en Android. La app nativa con Expo es una fase posterior y no cambia este valor hasta que exista.)

## Stack

Decidido en /office-hours y /plan-eng-review:
- Monorepo con backend Django + Django Ninja sobre PostgreSQL gestionado. El proveedor de nube está **Por decidir**.
- Web en Next.js. La reunión es una PWA 100 % de cliente (Serwist, sobre Webpack).
- Fase posterior: Expo.
- Supabase no es parte del stack: solo es la fuente de lectura para importar datos.

## Users

- **Junta de la ACAP, en la reunión.** La forman la Presidenta o el Presidente, el Registrador, el Portador de Caja y los Contadores 1 y 2. Llevan el libro del grupo una vez al mes, con un celular Android de gama baja, al aire libre o en un salón comunal, a menudo sin señal. En comunidades indígenas solo hay internet cuando alguien viaja al pueblo. Tienen baja alfabetización digital y lectora variable, pero manejan bien los números y el efectivo.
- **Socios y socias (miembros).** Aportan, piden préstamos internos y abonan. En el MVP no tienen sesión propia: ven el resumen en la reunión y reciben su comprobante por enlace.
- **Equipo de la Fundación CoimpactoB, en la oficina.** Admin, Dirección, coordinador territorial, facilitador de campo y analista. Revisan pendientes, consolidan las 27 ACAP o más, migran datos y acompañan a las juntas.

Hay dos ejes de rol. El rol de plataforma (Fundación) y el cargo, que es por membresía y por ciclo (Presidente, Portador de Caja, Registrador, Contador 1 y 2, Miembro).

## Product Purpose

Credimpacto es el **libro contable** de los grupos de ahorro y crédito comunitario (ACAP / GLAC) de Colombia: Juntas de Acción Comunal, Consejos Comunitarios étnicos y grupos no formalizados.

El MVP cubre la reunión completa: aportes, multas, préstamos internos con doble firma, abonos, arqueo, cierre de reunión y de ciclo, comprobantes, el consolidado de la Fundación y la migración de las ACAP existentes.

Reemplaza el cuaderno de papel y el chatbot de WhatsApp anterior, que se retira. La información queda centralizada en la nube.

Hay éxito cuando una junta cierra su reunión sin señal, con la caja cuadrada y firmada, y la Fundación recibe ese libro sin tener que volver a digitarlo. Los criterios medibles están en el documento de diseño.

## Positioning

El dinero es del grupo: lo custodia la caja o una entidad vigilada aliada, nunca Credimpacto. La app solo lleva el libro, y lo lleva como lo llevaría una junta honesta en papel:
- Es solo-agregar: corregir es tachar y reversar.
- Funciona sin señal.
- Lo firman cargos distintos.
- Lo verifica el servidor.

Un banco o una billetera digital no puede decir eso con la misma verdad.

## Operating Context

- **Reunión mensual.** La guía un asistente de 9 pasos: asistencia, aportes, multas, préstamos, abonos, arqueo a ciegas por denominación, cierre con firmas y comprobantes.
- **Un dispositivo por reunión.** Hay un solo celular escritor. Si falla, la reunión sigue en el cuaderno y se digita después como «diferido».
- **Sincronización.** Se hace cuando vuelve la señal, en lotes, y el servidor tiene la última palabra.
- **Firmas.** Cada cargo firma con un PIN de 6 dígitos en el celular registrado. Se necesitan al menos 2 firmas de cargos distintos.
- **Dinero.** Se maneja en pesos colombianos enteros, con formato es-CO.
- **Objetos que ya existen en la reunión:** el cuaderno, la caja, los billetes y las monedas, y el acta.
- **Oficina.** Tiene 5 secciones: Pendientes, ACAP, Personas, Indicadores y Configuración.

## Capabilities and Constraints

- **Integridad:**
  - El libro es solo-agregar y el UUID lo genera el cliente.
  - Toda escritura es idempotente y auditable.
  - Los estados de un movimiento son provisional, confirmado, rechazado, en_conflicto, por_validar y con_observaciones.
- **Seguridad y datos:**
  - Mínimo privilegio, sin secretos en el código y auditoría de cada cambio.
  - Habeas Data, según la Ley 1581 de 2012.
- **Sin servicios pagos de terceros** para diseño o IA. No hay IA en el MVP.
- **Fuera del MVP:**
  - Los módulos de IA, scoring, proyectos y academia del mockup.
  - La vista con sesión del socio.
  - El traspaso de escritor sin señal.
- **Por decidir:**
  - El proveedor de nube.
  - Cómo se identifica a los miembros cuando comparten teléfono.
  - La política de cierre de ciclo.
  - El significado oficial de la sigla ACAP.
  - El canal de entrega del comprobante.

## Brand Commitments

- Nombre: **Credimpacto**, de la Fundación CoimpactoB (https://coimpactob.com). La empresa es Credimpacto Tech S.A.S., un proveedor de software.
- **No somos un banco.** Ningún texto, flujo ni imagen puede insinuar que custodiamos o captamos dinero.
- Lo que la junta debe sentir: «Nuestro dinero está bien contado».
- Del mockup (https://coimpacto-b.vercel.app) se hereda el azul marino y el naranja de marca. El sistema visual está en DESIGN.md.
- La interfaz es en español de Colombia y se le habla a la junta con «usted».

## Evidence on Hand

- Hay 27 ACAP con datos reales en el proyecto Supabase anterior, que se usa solo como fuente para importarlos.
- El documento legal y de negocio es el chat de Gemini «Modelo legal para fintech de ahorro comunitario» (un PDF del equipo).
- Está el mockup analítico de referencia.
- Hay investigación de diseño citada en DESIGN.md (pilotos de digitalización de grupos de ahorro y CSCW 2021).
- **Lo que no tenemos todavía:** testimonios, métricas de uso del piloto, logos de aliados financieros ni el nombre de la entidad vigilada aliada. Nada de esto se puede inventar.

## Product Principles

1. **El libro es del grupo; el dinero, también.** Somos el cuaderno, no la caja.
2. **Nada se borra.** Corregir deja rastro visible, porque la confianza se construye mostrando el error, no escondiéndolo.
3. **La reunión no espera a la señal.** Todo lo de campo funciona sin internet y avisa con palabras qué está guardado aquí y qué llegó a la Fundación.
4. **Contar antes que leer.** Se apoya en la buena aritmética y en los objetos que la junta ya conoce, no en párrafos.
5. **Dos manos firman.** Ninguna decisión de dinero depende de una sola persona.

## Accessibility & Inclusion

- **Campo:**
  - Texto de 18 px como mínimo y cifras clave de 32 px como mínimo.
  - Toques de 56 dp y contraste de 7:1.
  - Solo modo claro, para leer al sol.
- **Baja alfabetización:**
  - Cada estado lleva ícono, palabra y color, y el color nunca va solo.
  - El valor del dinero va también en letras.
  - Una sola acción principal por pantalla y textos cortos en lenguaje llano.
- **Rendimiento:** debe funcionar en Android de gama baja con poca batería; respetar `prefers-reduced-motion`.
- **Conectividad:** la conexión llega cada varias semanas en algunas comunidades étnicas, así que los datos pendientes nunca vencen.
