// Avisos locales con expo-notifications (N14). El permiso se pide después del primer
// enrolamiento explicando para qué; si se niega, la app funciona igual.

import * as Notifications from "expo-notifications";

import type { Programador } from "./recordatorios";

export const programadorNativo: Programador = {
  async pedirPermiso() {
    const actual = await Notifications.getPermissionsAsync();
    if (actual.granted) return true;
    if (!actual.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  },
  cancelarTodos: () => Notifications.cancelAllScheduledNotificationsAsync(),
  async programar(r) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.titulo, body: r.cuerpo },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.cuando },
    });
  },
};
