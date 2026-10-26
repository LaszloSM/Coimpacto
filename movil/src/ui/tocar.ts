// Vibraciones de la app (expo-haptics). Una por acción, en el mismo instante que lo que se ve,
// y nunca como única señal: con la vibración apagada la pantalla dice lo mismo.

import * as Haptics from "expo-haptics";

const callar = () => undefined;

export const tocar = {
  /** Un valor cambia un paso (contadores, casillas, teclas). */
  paso: () => void Haptics.selectionAsync().catch(callar),
  /** Algo se guarda o se confirma (guardar un aporte, abrir la reunión). */
  firme: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(callar),
  /** Cae el sello: algo pesado llega al papel. */
  sello: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(callar),
  bien: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(callar),
  mal: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(callar),
};
