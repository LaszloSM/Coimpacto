// Cliente tipado de la API. Los tipos (esquema.ts) se generan con `npm run api:tipos` desde la raíz;
// CI falla si el contrato del backend cambió y no se regeneraron.
import createClient from "openapi-fetch";
import type { paths } from "./esquema";

export type { components, paths } from "./esquema";

export function crearCliente(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}
