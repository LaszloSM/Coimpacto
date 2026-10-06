# TODOS

## Libro/Sync

### Traspaso de escritor offline

**What:** Permitir que otro celular continúe una reunión sin señal si el celular escritor falla (épocas de escritor, corte por secuencia, conflictos).

**Why:** Evitar que la junta tenga que digitar después desde el cuaderno cuando falla el celular.

**Context:** Recortado del MVP en /plan-eng-review D1. Retomar solo si en el piloto el celular escritor falla en más de 1 de cada 10 reuniones. Diseño previo y observaciones R2-1 a R2-4 en docs/designs/credimpacto-mvp-libro-contable.md.

**Effort:** L
**Priority:** P3
**Depends on:** datos del piloto sobre fallas de celulares.

## App Expo

### Vista con sesión del miembro

**What:** Que cada miembro vea su saldo, historial y préstamo desde su propio celular.

**Why:** Transparencia individual entre reuniones.

**Context:** Pospuesta en /plan-eng-review D3. En el MVP el miembro solo ve el resumen provisional en la reunión y el comprobante confirmado por enlace.

**Effort:** M
**Priority:** P2
**Depends on:** fase Expo y pregunta abierta 2 (identificación de miembros con teléfonos compartidos).

### Evaluar cola propia vs motor de sincronización

**What:** Comparar la cola de sincronización propia del MVP con un motor como PowerSync antes de construir la app Expo.

**Why:** Si Expo necesita escritura multi-dispositivo sin señal, no reconstruir algo difícil que ya existe.

**Context:** Enfoque C del documento de diseño (descartado para el MVP porque escribe un solo celular por reunión). Decidido en /plan-eng-review D28.

**Effort:** S
**Priority:** P3
**Depends on:** inicio de la fase Expo.

## Completed
