// Prueba de humo del entorno offline: IndexedDB simulado con fake-indexeddb.
// La cola de sincronización real (S5) se prueba sobre este mismo entorno.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open("credimpacto-prueba", 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore("cola", { keyPath: "id" });
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

describe("IndexedDB en pruebas", () => {
  it("guarda y lee un movimiento por su UUID", async () => {
    const db = await abrir();
    const movimiento = { id: crypto.randomUUID(), tipo: "aporte", pesos: 50000 };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("cola", "readwrite");
      tx.objectStore("cola").put(movimiento);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const leido = await new Promise((resolve) => {
      const pedido = db.transaction("cola").objectStore("cola").get(movimiento.id);
      pedido.onsuccess = () => resolve(pedido.result);
    });
    expect(leido).toEqual(movimiento);
  });
});
