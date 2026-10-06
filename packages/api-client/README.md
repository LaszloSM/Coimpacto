# Cliente de la API

Tipos y cliente `openapi-fetch` generados desde el OpenAPI del backend (Django Ninja).

```bash
npm run api:tipos   # desde la raíz: exporta openapi.json y regenera src/esquema.ts
```

No editar `openapi.json` ni `src/esquema.ts` a mano. CI los regenera y falla si difieren.
