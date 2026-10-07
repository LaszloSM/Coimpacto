import { StatusBar } from "expo-status-bar";

import { Inicio } from "./pantallas/Inicio";

export function App() {
  return (
    <>
      {/* Solo modo claro (DESIGN.md): íconos oscuros sobre papel. */}
      <StatusBar style="dark" />
      <Inicio />
    </>
  );
}
