import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useEstadoRed } from "../../estado/estadoRed";
import { androidLan } from "../../servicios/androidLan";
import { aplicarAccionLANRecibida, crearSnapshotLAN, hidratarDesdeLAN } from "../../servicios/appLAN";
import { conectarLAN, desconectarLAN } from "../../servicios/socketCliente";
import { obtenerIdentificadorDispositivo, obtenerTiendaIdActual } from "../../servicios/supabase";

interface PropsServidorLAN {
  esMaestro: boolean;
  esVistaCliente: boolean;
  datosInicialesCargados: boolean;
  hostLanEnlace: string | null;
  ipMaestro: string | null;
  setIpMaestro: (ip: string) => void;
  setEstadoLAN: (activo: boolean, dispositivosConectados: number) => void;
}

export default function useServidorLAN({
  esMaestro,
  esVistaCliente,
  datosInicialesCargados,
  hostLanEnlace,
  ipMaestro,
  setIpMaestro,
  setEstadoLAN,
}: PropsServidorLAN) {
  useEffect(() => {
    if (esVistaCliente || !esMaestro || !datosInicialesCargados || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    let cancelado = false;
    let suscripciones: Awaited<ReturnType<typeof androidLan.addListener>>[] = [];
    void (async () => {
      try {
        suscripciones = await Promise.all([
          androidLan.addListener("serverStatus", (estado) => {
            setEstadoLAN(estado.activo, estado.dispositivosConectados);
          }),
          androidLan.addListener("snapshotRequested", ({ socketId }) => {
            void androidLan.emitSnapshot({ socketId, snapshot: crearSnapshotLAN() }).catch((error: unknown) => {
              console.error("No se pudo enviar el estado inicial por LAN desde Android:", error);
            });
          }),
          androidLan.addListener("slaveAction", aplicarAccionLANRecibida),
        ]);
        if (cancelado) {
          suscripciones.forEach((suscripcion) => void suscripcion.remove());
          return;
        }
        const [tiendaId, deviceId] = await Promise.all([
          obtenerTiendaIdActual(),
          obtenerIdentificadorDispositivo()
        ]);
        if (cancelado || !useEstadoRed.getState().esMaestro) {
          suscripciones.forEach((suscripcion) => void suscripcion.remove());
          return;
        }
        const estado = await androidLan.startServer({ tiendaId: tiendaId || "", deviceId });
        if (cancelado) {
          await androidLan.stopServer();
          suscripciones.forEach((suscripcion) => void suscripcion.remove());
        } else {
          setEstadoLAN(estado.activo, estado.dispositivosConectados);
        }
      } catch (error) {
        console.error("No se pudo iniciar el servidor LAN de Android:", error);
        if (!cancelado) setEstadoLAN(false, 0);
      }
    })();
    return () => {
      cancelado = true;
      suscripciones.forEach((suscripcion) => void suscripcion.remove());
      void androidLan.stopServer().catch((error: unknown) => {
        console.error("No se pudo detener el servidor LAN de Android:", error);
      });
    };
  }, [esMaestro, esVistaCliente, datosInicialesCargados, setEstadoLAN]);

  useEffect(() => {
    if (esVistaCliente) return;
    if (esMaestro && !datosInicialesCargados) return;
    const api = window.apiLocal;
    if (esMaestro) {
      desconectarLAN();
      if (api) {
        api.onEstadoLAN((estado: { activo: boolean; dispositivosConectados: number }) => {
          setEstadoLAN(estado.activo, estado.dispositivosConectados);
        });
        api.onSolicitudSnapshotLAN((socketId: string) => {
          void api.emitirSnapshotLAN(socketId, crearSnapshotLAN()).catch((error: unknown) => {
            console.error("No se pudo enviar el estado inicial por LAN:", error);
          });
        });
        api.onAccionDeEsclavo(aplicarAccionLANRecibida);
        void Promise.all([obtenerTiendaIdActual(), obtenerIdentificadorDispositivo()])
          .then(([tiendaId, deviceId]) => {
            if (!useEstadoRed.getState().esMaestro) return null;
            return api.iniciarServidorLAN(tiendaId || "", deviceId);
          })
          .then((estado) => {
            if (estado) setEstadoLAN(estado.activo, estado.dispositivosConectados);
          }).catch((error: unknown) => {
            console.error("No se pudo iniciar el servidor LAN:", error);
          });
      }
      return;
    }

    if (api) {
      void api.detenerServidorLAN().catch((error: unknown) => {
        console.error("No se pudo detener el servidor LAN del dispositivo de respaldo:", error);
      });
    }
    if (hostLanEnlace) {
      if (ipMaestro !== hostLanEnlace) setIpMaestro(hostLanEnlace);
      conectarLAN(hostLanEnlace, aplicarAccionLANRecibida, (snapshot) => {
        void hidratarDesdeLAN(snapshot).catch((error: unknown) => {
          console.error("No se pudo cargar el estado local del Cerebro desde el QR:", error);
        });
      });
    } else if (window.location.protocol === "http:" && window.location.port === "4000") {
      const ipServidorLocal = window.location.hostname;
      if (ipMaestro !== ipServidorLocal) setIpMaestro(ipServidorLocal);
      conectarLAN(ipServidorLocal, aplicarAccionLANRecibida, (snapshot) => {
        void hidratarDesdeLAN(snapshot).catch((error: unknown) => {
          console.error("No se pudo cargar el estado local del Cerebro:", error);
        });
      });
    } else if (window.location.protocol === "http:" && window.location.port === "4001") {
      const ipServidorLocal = window.location.hostname;
      if (ipMaestro !== ipServidorLocal) setIpMaestro(ipServidorLocal);
      conectarLAN(ipServidorLocal, aplicarAccionLANRecibida, (snapshot) => {
        void hidratarDesdeLAN(snapshot).catch((error: unknown) => {
          console.error("No se pudo cargar el estado local del Cerebro Android:", error);
        });
      });
    } else if (ipMaestro) {
      conectarLAN(ipMaestro, aplicarAccionLANRecibida, (snapshot) => {
        void hidratarDesdeLAN(snapshot).catch((error: unknown) => {
          console.error("No se pudo cargar el estado local del Cerebro:", error);
        });
      });
    }
  }, [esMaestro, esVistaCliente, datosInicialesCargados, hostLanEnlace, ipMaestro, setIpMaestro, setEstadoLAN]);
}
