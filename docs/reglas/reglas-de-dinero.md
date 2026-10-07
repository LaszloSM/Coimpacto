# Reglas de dinero

Especificación portada de las RPC de Supabase (proyecto `[proyecto-supabase]`, leídas en solo lectura el
2026-10-06). Es el contrato de `backend/libro/reglas.py` (autoridad) y `packages/reglas/` (app Android y web, D19). Los dos
ejecutan los casos de `packages/casos-reglas/casos/`.

Convenciones:
- Todo monto es un entero de pesos colombianos.
- Las tasas viajan como texto decimal exacto. **La tasa de interés está en porcentaje mensual**, igual que en
  Supabase: `"2"` significa 2 % al mes, `"2.5"` es 2,5 %.
- `redondear(x)` es al peso con mitad hacia arriba. Equivale a `round(numeric)` de PostgreSQL para montos positivos.
- `piso(x)` es el redondeo hacia abajo.

## 1. Registro de ahorro (`fn_validar_registro_ahorro`, `fn_registrar_ahorro`)

Los precios se congelan al abrir la reunión (`fn_abrir_reunion`): `valor_accion`, `valor_fondo_social`,
`valor_multa` y `max_acciones`. El servidor nunca confía en montos calculados por el cliente.

- `acciones ≤ max_acciones` de la reunión. Si no se cumple, se rechaza.
- `ahorro = acciones × valor_accion`
- `multas = cantidad_multas × valor_multa`
- `aporte_fondo_social` y `ventas` se registran tal cual vienen (enteros ≥ 0).
- Total de la persona en la reunión: `ahorro + aporte_fondo_social + multas`.

## 2. Préstamo interno (`fn_calcular_prestamo`)

**Interés fijo sobre el capital inicial** (decisión D1 de T3, 2026-10-06: se conserva la regla que ya usan las
ACAP).

- Requiere `capital > 0` y `num_cuotas > 0`.
- `interes_mensual = redondear(capital × tasa / 100)`
- `total_pagar = capital + interes_mensual × num_cuotas`
- `cuota_mensual = redondear(total_pagar / num_cuotas)`. La suma de cuotas puede diferir de `total_pagar` en unos
  pesos; manda el saldo, así que la última cuota es lo que falte.
- Una persona no puede tener dos préstamos vigentes con saldo en el mismo ciclo.

Ejemplo: $1.000.000 al 2 % en 3 cuotas da $20.000 de interés mensual, $1.060.000 en total y una cuota de
$353.333.

## 3. Abono (`fn_registrar_abono`, vista `v_saldo_prestamo`)

- `saldo = total_pagar − Σ abonos`. Se exige `0 < monto ≤ saldo`.
- El abono se divide en proporción fija al interés total del préstamo:
  - `interes = redondear(monto × (interes_mensual × num_cuotas) / total_pagar)`
  - `capital = monto − interes`
- Cuando el saldo llega a 0, el préstamo pasa a `pagado`.
- Hay mora si el préstamo sigue vigente con saldo y ya pasaron `num_cuotas` meses desde su fecha.

## 4. Cierre de ciclo (`fn_preview_cierre`, `fn_confirmar_cierre`)

### Política de cierre (`politica_cierre`, pendiente de confirmar por CoimpactoB)

| Campo | Valor actual | Significado |
|---|---|---|
| `reparte_fondo_social` | no | El fondo social funciona como seguro comunitario. |
| `multas_a_repartible` | sí | Las multas son ganancia del grupo. |
| `ventas_a_repartible` | no | Todavía no se sabe qué son las "ventas". |
| `multiplo_redondeo` | 1000 | La entrega se redondea hacia abajo a billetes de $1.000. |

Sin política confirmada, el preview se calcula con aviso, pero el cierre se bloquea (D19 del plan).

### Totales del ciclo

- `caja = ahorro + fondo_social + multas + interes_cobrado + ventas`
- `ganancia = interes_cobrado + (multas si multas_a_repartible) + (ventas si ventas_a_repartible)`
- `repartible = ahorro + ganancia + (fondo_social si reparte_fondo_social)`
- Si el ciclo tiene 0 acciones, no hay nada que repartir (error `SIN_MOVIMIENTOS`).

`interes_cobrado` es la suma de los componentes de interés de los abonos del ciclo. No es el interés pactado.

### Por miembro (solo quienes tienen registros de ahorro en el ciclo)

- `participacion = piso(ganancia × acciones_miembro / acciones_total)`
- `bruto = ahorro_miembro + participacion + (fondo_miembro si reparte_fondo_social)`
- `deuda` = suma del saldo de sus préstamos vigentes.
- `a_entregar = máx(piso((bruto − deuda) / multiplo) × multiplo, 0)`
- `deuda_arrastrada = máx(deuda − bruto, 0)`

### Residuo

- `residuo = repartible − Σ a_entregar`. Queda registrado en el cierre como movimiento propio.

Observación para la Dirección: el residuo incluye la deuda que se descuenta de cada entrega, además de los pesos
que se pierden al redondear a billetes. Esa deuda no es efectivo en caja, así que un residuo grande puede querer
decir préstamos sin pagar y no plata sobrante. Se mantiene igual que en Supabase hasta que CoimpactoB decida.

## 5. Firmas y canonicalización

El hash de firma es SHA-256 sobre JSON canónico RFC 8785 (`core/canonico.py`, `packages/reglas/src/canonico.ts`).
Solo admite enteros seguros: el dinero nunca viaja como número con decimales.
