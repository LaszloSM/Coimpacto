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

### Socio: pedir y votar préstamos desde su celular (fase 2)

**What:** Que el socio solicite un préstamo y vote la aprobación desde la app.

**Why:** Lo pide el PDF de contexto (pantalla "Solicitud de Crédito Comunitario" y votación).

**Context:** Decisión D3 (2026-10-06): en el MVP el socio solo ve su saldo, aportes y préstamo. Pedir y votar sigue en la reunión. Requiere voto digital con validez (Ley 527) e identidad resuelta en celulares compartidos.

**Effort:** M
**Priority:** P2
**Depends on:** vista de solo lectura del socio en producción.

### Evaluar cola propia vs motor de sincronización

**What:** Comparar la cola de sincronización propia del MVP con un motor como PowerSync antes de construir la app Expo.

**Why:** Si Expo necesita escritura multi-dispositivo sin señal, no reconstruir algo difícil que ya existe.

**Context:** Enfoque C del documento de diseño (descartado para el MVP porque escribe un solo celular por reunión). Decidido en /plan-eng-review D28.

**Effort:** S
**Priority:** P1 (ahora: la app Expo entra al MVP por D2)
**Depends on:** revisión de ingeniería del cambio a Expo.

## Notificaciones

### Recordatorios del ciclo

**What:** Recordar a la junta y a los socios la próxima reunión y las cuotas de préstamo, como hacía el chatbot.

**Why:** Es una función del chatbot que se retira; sin ella la plataforma no lo reemplaza del todo.

**Context:** Segundo cambio de alcance (2026-10-06). Notificaciones push de Expo cuando haya señal; definir si se necesita SMS para quien no tiene datos.

**Effort:** S
**Priority:** P2
**Depends on:** app Expo con sesión.

## Integraciones

### Aliado financiero (BaaS / SEDPE)

**What:** Billeteras o depósitos bajo monto, desembolsos por API, códigos de recarga y retiro en corresponsales, conciliación con el extracto.

**Why:** Es la parte del modelo del PDF que saca el efectivo de la caja física.

**Context:** Fuera del MVP hasta tener un aliado firmado. El libro y las firmas del MVP ya dejan el historial confiable que el aliado pide.

**Effort:** L
**Priority:** P3
**Depends on:** contrato con un banco o SEDPE.

## Completed
