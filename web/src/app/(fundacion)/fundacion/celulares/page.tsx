// Acceso a la app: la junta de cada ACAP entra con el usuario y la clave que crea la Fundación
// (sin QR). Esta página dice los pasos y lleva a Configuración, donde se crean.

import estilos from "../_panel/tablero.module.css";

const PASOS = [
  {
    titulo: "La ACAP, su ciclo y sus cargos",
    texto: "Cree la ACAP y su ciclo activo. Luego, en el ciclo, asigne Presidente, Portador de Caja, Registrador y Contadores.",
    enlace: "/admin/acap/ciclo/",
    accion: "Ver ciclos",
  },
  {
    titulo: "El usuario de la app",
    texto: "Cree un usuario con su clave (12 caracteres o más) y elija la ACAP. Ese usuario solo registra el celular de esa ACAP; no entra a esta oficina.",
    enlace: "/admin/cuentas/usuario/add/",
    accion: "Crear usuario",
    principal: true,
  },
  {
    titulo: "En el celular de la junta",
    texto: "Con señal, se toca «Registrar este celular» y se escriben el usuario y la clave. La Presidencia crea su PIN y da de alta a los demás cargos. Después la reunión funciona sin señal.",
  },
  {
    titulo: "Si se pierde el celular",
    texto: "Retírelo en Celulares registrados y cambie la clave del usuario de la ACAP.",
    enlace: "/admin/cuentas/dispositivo/",
    accion: "Celulares registrados",
  },
];

export default function AccesoApp() {
  return (
    <main className={estilos.pagina}>
      <header className={estilos.cabeza}>
        <div>
          <h1 className={estilos.titulo}>Acceso a la app</h1>
          <p className={estilos.subtitulo}>Cada ACAP entra a la app con un usuario y una clave que crea la Fundación.</p>
        </div>
      </header>
      <ol className={estilos.pasos}>
        {PASOS.map((paso, i) => (
          <li key={paso.titulo} className={estilos.paso}>
            <span className={estilos.pasoNumero} aria-hidden>
              {i + 1}
            </span>
            <div>
              <h2 className={estilos.pasoTitulo}>{paso.titulo}</h2>
              <p className={estilos.pasoTexto}>{paso.texto}</p>
              {paso.enlace ? (
                <a className={paso.principal ? estilos.botonPrincipal : estilos.botonSecundario} href={paso.enlace}>
                  {paso.accion}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
