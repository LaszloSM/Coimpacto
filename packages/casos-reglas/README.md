# Casos de reglas compartidos

Cada archivo de `casos/` es un JSON con casos de entrada y salida esperada para una regla de dinero.
Los mismos casos los ejecutan:

- el backend: `backend/core/tests/test_casos_compartidos.py` (pytest);
- la web: `web/src/lib/dinero.test.ts` (Vitest).

Si Python y TypeScript no dan lo mismo para un caso, falla CI. Así se evita que el celular y el
servidor calculen distinto (D19 del diseño aprobado).

Formato:

```json
{ "regla": "formato-pesos", "descripcion": "...", "casos": [{ "nombre": "...", "entrada": 0, "esperado": "..." }] }
```

Los montos son siempre pesos enteros. `\u00a0` es el espacio no separable entre `$` y la cifra.
