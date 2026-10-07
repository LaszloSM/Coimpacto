# Casos de reglas compartidos

Cada archivo de `casos/` es un JSON con casos de entrada y salida esperada para una regla de dinero.
Los mismos casos los ejecutan:

- el backend: `backend/core/tests/` y `backend/libro/tests/` (pytest);
- TypeScript (app Android y web): `packages/reglas/src/*.test.ts` (Vitest).

Si Python y TypeScript no dan lo mismo para un caso, falla CI. Así se evita que el celular y el
servidor calculen distinto (D19 del diseño aprobado).

Formato:

```json
{ "regla": "formato-pesos", "descripcion": "...", "casos": [{ "nombre": "...", "entrada": 0, "esperado": "..." }] }
```

Los montos son siempre pesos enteros. `\u00a0` es el espacio no separable entre `$` y la cifra.

## Archivos

| Archivo | Regla | Origen |
|---|---|---|
| `formato-pesos.json` | Formato es-CO de un monto | a mano |
| `canonico-jcs.json` | JSON canónico RFC 8785 para firmas | a mano |
| `registro-ahorro.json`, `prestamo.json`, `abono.json`, `cierre-ciclo.json` | Reglas de [docs/reglas/reglas-de-dinero.md](../../docs/reglas/reglas-de-dinero.md) | `scripts/generar_casos.py` |

Los archivos generados no se editan a mano: se cambia el script y se corre
`python packages/casos-reglas/scripts/generar_casos.py`. El script tiene su propio oráculo (fracciones exactas)
y verifica contra valores calculados a mano. CI lo vuelve a correr y falla si el resultado no coincide con lo
commiteado.
