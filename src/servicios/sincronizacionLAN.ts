import { useEstadoRed } from "../estado/estadoRed";
import { useEstadoPlan } from "../estado/estadoPlan";
import { emitirAccionMaestro } from "./socketCliente";
import { Capacitor } from "@capacitor/core";
import { androidLan } from "./androidLan";

export interface AccionLAN {
  tipo: string;
  payload: unknown;
}

export const enviarAccionLAN = (accion: AccionLAN): boolean => {
  const { esMaestro, conectadoLAN } = useEstadoRed.getState();
  if (esMaestro) {
    const apiLocal = window.apiLocal;
    if (apiLocal) {
      apiLocal.emitirAEsclavos(accion).catch((error: unknown) => {
        console.error("No se pudo propagar el cambio del Cerebro por LAN:", error);
      });
    } else if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      androidLan.emitAction({ action: accion }).catch((error: unknown) => {
        console.error("No se pudo propagar el cambio del Cerebro Android por LAN:", error);
      });
    }
    return false;
  }
  if (!conectadoLAN) return false;
  return emitirAccionMaestro(accion);
};

export const debeSincronizarConNube = (): boolean => {
  const { permiteNube } = useEstadoPlan.getState();
  const { esMaestro, conectadoLAN } = useEstadoRed.getState();
  return permiteNube && (esMaestro || !conectadoLAN);
};
