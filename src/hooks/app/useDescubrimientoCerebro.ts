import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { androidLan } from "../../servicios/androidLan";
import { obtenerIdentificadorDispositivo, obtenerTiendaIdActual } from "../../servicios/supabase";
import { useEstadoRed } from "../../estado/estadoRed";

interface PropsDescubrimientoCerebro {
  esVistaCliente: boolean;
  setIpMaestro: (ip: string) => void;
}

export default function useDescubrimientoCerebro({ esVistaCliente, setIpMaestro }: PropsDescubrimientoCerebro) {
  useEffect(() => {
    if (esVistaCliente) return;
    let cancelado = false;
    let quitarListener: (() => void) | null = null;
    let listenerAndroid: Awaited<ReturnType<typeof androidLan.addListener>> | null = null;

    const instalarDeteccion = async () => {
      const [tiendaId, deviceId] = await Promise.all([
        obtenerTiendaIdActual(),
        obtenerIdentificadorDispositivo()
      ]);
      if (cancelado) return;

      const detectarCerebro = (cerebro: { ip: string; puertoWeb: number; tiendaId: string; deviceId: string; plataforma: string; }) => {
        if (cerebro.tiendaId !== tiendaId || cerebro.deviceId === deviceId) return;
        if ([4000, 4001].includes(cerebro.puertoWeb)) {
          localStorage.setItem("puerto_web_maestro_lan", String(cerebro.puertoWeb));
        }

        if (!useEstadoRed.getState().esMaestro) {
          setIpMaestro(cerebro.ip);
        }
      };

      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
        listenerAndroid = await androidLan.addListener("brainDetected", detectarCerebro);
        if (cancelado) {
          await listenerAndroid.remove();
          return;
        }

        await androidLan.startDiscovery();
        return;
      }

      const api = window.apiLocal;
      if (!api) return;
      quitarListener = api.onCerebroDetectado(detectarCerebro);
      await api.iniciarDescubrimientoLAN();
    };
    void instalarDeteccion().catch((error: unknown) => {
      console.error("No se pudo iniciar el descubrimiento del Cerebro por LAN:", error);
    });

    return () => {
      cancelado = true;
      quitarListener?.();
      if (listenerAndroid) void listenerAndroid.remove();
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
        void androidLan.stopDiscovery().catch((error: unknown) => {
          console.error("No se pudo detener el descubrimiento del Cerebro por LAN:", error);
        });
      } else {
        void window.apiLocal?.detenerDescubrimientoLAN().catch((error: unknown) => {
          console.error("No se pudo detener el descubrimiento del Cerebro por LAN:", error);
        });
      }
    };
  }, [esVistaCliente, setIpMaestro]);
}
