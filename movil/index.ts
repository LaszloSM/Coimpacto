import { registerRootComponent } from "expo";
import { install } from "react-native-quick-crypto";

import { App } from "./src/App";

// crypto.subtle y crypto.getRandomValues globales, nativos (Hermes no los trae). Los usan
// @credimpacto/reglas (hashCanonico) y la seguridad de la app (EX1).
install();

registerRootComponent(App);
