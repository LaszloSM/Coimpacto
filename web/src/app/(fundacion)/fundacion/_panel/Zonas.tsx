// Desempeño por zona como lista ordenada: cumplimiento con su barra (sobre 100 %) y la mora
// como cifra con tono propio. Dos medidas de magnitud distinta no comparten un eje.

import { porcentaje } from "./formato";
import estilos from "./tablero.module.css";
import type { Tablero } from "./tipos";

function tonoMora(mora: number): "bien" | "atencion" | "alerta" {
  return mora > 6 ? "alerta" : mora > 2 ? "atencion" : "bien";
}

export function Zonas({ zonas }: { zonas: Tablero["series"]["zonas"] }) {
  const conZona = zonas.filter((z) => z.zona !== "Sin zona");
  const ordenadas = [...conZona].sort((a, b) => (b.cumplimiento ?? -1) - (a.cumplimiento ?? -1));
  return (
    <figure className={estilos.grafico}>
      <figcaption className={estilos.graficoCabeza}>
        <h3 className={estilos.graficoTitulo}>Desempeño por zona</h3>
        <p className={estilos.graficoSub}>Cumplimiento de pagos y mora de la cartera</p>
      </figcaption>
      {ordenadas.length ? (
        <table className={estilos.zonas}>
          <thead>
            <tr>
              <th scope="col">Zona</th>
              <th scope="col">Cumplimiento</th>
              <th scope="col">Mora</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((z) => (
              <tr key={z.zona}>
                <th scope="row">
                  {z.zona}
                  <span className={estilos.zonaCuenta}>
                    {z.comunidades} {z.comunidades === 1 ? "comunidad" : "comunidades"}
                  </span>
                </th>
                <td>
                  <span className={estilos.zonaBarra} aria-hidden>
                    <span
                      style={{
                        transform: `scaleX(${(z.cumplimiento ?? 0) / 100})`,
                      }}
                    />
                  </span>
                  <span className={estilos.zonaValor}>{porcentaje(z.cumplimiento)}</span>
                </td>
                <td className={estilos.zonaMora} data-tono={tonoMora(z.mora)}>
                  {porcentaje(z.mora)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={estilos.graficoVacio}>Asigne una zona a cada ACAP en Configuración para comparar territorios.</p>
      )}
    </figure>
  );
}
