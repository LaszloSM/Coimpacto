// Íconos de la app (Phosphor). Se cargan uno por uno: el paquete entero son 1.500 íconos y el
// APK corre en celulares de gama baja. Con require() Metro empaqueta solo estos archivos y
// TypeScript no revisa el código fuente del paquete (los tipos salen de su índice publicado).
/* eslint-disable @typescript-eslint/no-require-imports */

import type { Icon } from "phosphor-react-native";

export const Archivo: Icon = require("phosphor-react-native/src/icons/Archive").ArchiveIcon;
export const Recontar: Icon = require("phosphor-react-native/src/icons/ArrowCounterClockwise").ArrowCounterClockwiseIcon;
export const Flecha: Icon = require("phosphor-react-native/src/icons/ArrowRight").ArrowRightIcon;
export const Borrar: Icon = require("phosphor-react-native/src/icons/Backspace").BackspaceIcon;
export const Campana: Icon = require("phosphor-react-native/src/icons/Bell").BellIcon;
export const Calendario: Icon = require("phosphor-react-native/src/icons/CalendarBlank").CalendarBlankIcon;
export const Atras: Icon = require("phosphor-react-native/src/icons/CaretLeft").CaretLeftIcon;
export const Ir: Icon = require("phosphor-react-native/src/icons/CaretRight").CaretRightIcon;
export const Chulo: Icon = require("phosphor-react-native/src/icons/Check").CheckIcon;
export const Listo: Icon = require("phosphor-react-native/src/icons/CheckCircle").CheckCircleIcon;
export const NubeSubir: Icon = require("phosphor-react-native/src/icons/CloudArrowUp").CloudArrowUpIcon;
export const NubeLista: Icon = require("phosphor-react-native/src/icons/CloudCheck").CloudCheckIcon;
export const Monedas: Icon = require("phosphor-react-native/src/icons/Coins").CoinsIcon;
export const Celular: Icon = require("phosphor-react-native/src/icons/DeviceMobile").DeviceMobileIcon;
export const Prestamo: Icon = require("phosphor-react-native/src/icons/HandCoins").HandCoinsIcon;
export const Info: Icon = require("phosphor-react-native/src/icons/Info").InfoIcon;
export const Llave: Icon = require("phosphor-react-native/src/icons/Key").KeyIcon;
export const Candado: Icon = require("phosphor-react-native/src/icons/LockKey").LockKeyIcon;
export const Menos: Icon = require("phosphor-react-native/src/icons/Minus").MinusIcon;
export const Billete: Icon = require("phosphor-react-native/src/icons/Money").MoneyIcon;
export const Libreta: Icon = require("phosphor-react-native/src/icons/Notebook").NotebookIcon;
export const Pluma: Icon = require("phosphor-react-native/src/icons/PenNib").PenNibIcon;
export const Mas: Icon = require("phosphor-react-native/src/icons/Plus").PlusIcon;
export const Recibo: Icon = require("phosphor-react-native/src/icons/Receipt").ReceiptIcon;
export const Balanza: Icon = require("phosphor-react-native/src/icons/Scales").ScalesIcon;
export const Megafono: Icon = require("phosphor-react-native/src/icons/MegaphoneSimple").MegaphoneSimpleIcon;
export const Sello: Icon = require("phosphor-react-native/src/icons/Stamp").StampIcon;
export const Persona: Icon = require("phosphor-react-native/src/icons/UserPlus").UserPlusIcon;
export const Grupo: Icon = require("phosphor-react-native/src/icons/UsersThree").UsersThreeIcon;
export const Caja: Icon = require("phosphor-react-native/src/icons/Wallet").WalletIcon;
export const Alerta: Icon = require("phosphor-react-native/src/icons/WarningCircle").WarningCircleIcon;
export const Cruz: Icon = require("phosphor-react-native/src/icons/X").XIcon;
