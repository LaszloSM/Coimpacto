// Catálogo de cargos del almacén para las pantallas (nombre y permisos de cada cargo).
import { useEffect, useState } from "react";

import { tiposCargo, type TipoCargo } from "../seguridad/cargos";
import { useSesion } from "./contexto";

export function useTiposCargo(): TipoCargo[] {
  const { entorno } = useSesion();
  const [tipos, setTipos] = useState<TipoCargo[]>([]);
  useEffect(() => {
    void tiposCargo(entorno.almacen).then(setTipos);
  }, [entorno]);
  return tipos;
}
