// src/servicios/sincronizacionLAN.ts
import { useEstadoRed } from "../estado/estadoRed";
import { useEstadoPlan } from "../estado/estadoPlan";
import { emitirAccionMaestro, emitirSolicitudSyncEsclavo } from "./socketCliente"; // ACTUALIZADO
import { Capacitor } from "@capacitor/core";
import { androidLan } from "./androidLan";

export interface AccionLAN {
  tipo: string;
  payload: unknown;
}

export const enviarAccionLAN = (accion: AccionLAN): boolean => {
  const { esMaestro, conectadoLAN } = useEstadoRed.getState();
  
  // Evitar rebote de ventas que llegaron por sincronización masiva de esclavos
  if (accion.tipo === "LAN_VENTA_AGREGAR") {
    const payload = accion.payload as any;
    if (payload && payload._origenSyncEsclavo) {
      delete payload._origenSyncEsclavo; // Limpiar bandera temporal
      return false; // No propagarlo por LAN, solo subir a Supabase
    }
  }

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

// NUEVO: Pide al esclavo que mande sus ventas recientes al conectarse
export const sincronizarEsclavoConCerebro = (ventasLocales: any[]) => {
  const { esMaestro, conectadoLAN } = useEstadoRed.getState();
  if (esMaestro || !conectadoLAN) return;
  
  // Enviamos al cerebro las ventas que ocurrieron en los últimos 3 días como margen de seguridad
  const limiteDias = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const ventasPendientes = ventasLocales.filter(v => new Date(v.fecha).getTime() > limiteDias);
  
  if (ventasPendientes.length > 0) {
    emitirSolicitudSyncEsclavo({
      tipo: "LAN_SYNC_VENTAS_ESCLAVO",
      payload: ventasPendientes
    });
  }
};