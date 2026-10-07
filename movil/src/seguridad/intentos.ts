// Cinco intentos de PIN por cargo en este celular; al quinto fallo el cargo queda "En pausa"
// hasta sincronizar y firma un reemplazo (E2).
//
// El intento se cuenta ANTES de probar el PIN y se descuenta solo si acierta: cerrar la app a
// mitad de la derivación no devuelve el intento.

import type { AlmacenSeguro } from "./almacen";
import { PinIncorrecto } from "./llavero";

export const MAXIMO_INTENTOS = 5;

export class CargoEnPausa extends Error {
  constructor() {
    super("En pausa");
  }
}

export class PinFallido extends Error {
  constructor(readonly restantes: number) {
    super(restantes > 0 ? `PIN no coincide · quedan ${restantes} intentos` : "En pausa");
  }
}

interface Estado {
  fallos: number;
}

const clave = (cargoId: string) => `intentos.${cargoId}`;

export class ControlIntentos {
  constructor(private readonly almacen: AlmacenSeguro) {}

  private async leer(cargoId: string): Promise<Estado> {
    const texto = await this.almacen.leer(clave(cargoId));
    return texto ? (JSON.parse(texto) as Estado) : { fallos: 0 };
  }

  private escribir(cargoId: string, estado: Estado) {
    return this.almacen.escribir(clave(cargoId), JSON.stringify(estado));
  }

  async enPausa(cargoId: string): Promise<boolean> {
    return (await this.leer(cargoId)).fallos >= MAXIMO_INTENTOS;
  }

  async restantes(cargoId: string): Promise<number> {
    return Math.max(MAXIMO_INTENTOS - (await this.leer(cargoId)).fallos, 0);
  }

  /** Corre `probar` con el PIN si al cargo le quedan intentos. */
  async intentar<T>(cargoId: string, probar: () => Promise<T>): Promise<T> {
    const estado = await this.leer(cargoId);
    if (estado.fallos >= MAXIMO_INTENTOS) throw new CargoEnPausa();
    const conEsteIntento = { fallos: estado.fallos + 1 };
    await this.escribir(cargoId, conEsteIntento);
    try {
      const resultado = await probar();
      await this.escribir(cargoId, { fallos: 0 });
      return resultado;
    } catch (error) {
      if (error instanceof PinIncorrecto) {
        throw new PinFallido(MAXIMO_INTENTOS - conEsteIntento.fallos);
      }
      // Otro error (no del PIN): el intento no cuenta.
      await this.escribir(cargoId, estado);
      throw error;
    }
  }

  /** Al sincronizar, el servidor confirma el cargo y se levanta la pausa (TX5). */
  levantarPausa(cargoId: string) {
    return this.escribir(cargoId, { fallos: 0 });
  }
}
