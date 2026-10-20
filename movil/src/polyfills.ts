// Corre antes que cualquier pantalla (index.ts lo importa primero).
// crypto.subtle y crypto.getRandomValues globales y nativos: Hermes no los trae. Los usan
// @credimpacto/reglas (hashCanonico) y la seguridad de la app (EX1).
import { install } from "react-native-quick-crypto";

install();
