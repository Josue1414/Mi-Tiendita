// src/servicios/socketCliente.ts
import { io, Socket } from "socket.io-client";
import { useEstadoRed } from "../estado/estadoRed";
import { useEstadoVentas } from "../estado/estadoVentas"; // IMPORTAR

let socket: Socket | null = null;

export const desconectarLAN = () => {
  socket?.disconnect();
  socket = null;
  useEstadoRed.getState().setConectadoLAN(false);
};

export const conectarLAN = (
  ip: string,
  alRecibirAccion: (data: any) => void,
  alRecibirEstadoInicial?: (data: any) => void
) => {
  desconectarLAN();
  
  socket = io(`http://${ip}:4000`, {
    transports: ["websocket"],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000, 
    forceNew: true
  });
  
  socket.on("connect", () => {
    useEstadoRed.getState().setConectadoLAN(true);
    socket?.emit("registrar-dispositivo-lan");
    socket?.emit("solicitar-estado-inicial");

    // NUEVO: Cuando el esclavo se conecta, envía sus ventas locales recientes al Cerebro
    const ventas = useEstadoVentas.getState().ventas;
    if (ventas.length > 0) {
      import("./sincronizacionLAN").then(({ sincronizarEsclavoConCerebro }) => {
        sincronizarEsclavoConCerebro(ventas);
      });
    }
  });
  
  socket.on("disconnect", () => {
    useEstadoRed.getState().setConectadoLAN(false);
  });

  socket.on("connect_error", (error) => {
    useEstadoRed.getState().setConectadoLAN(false);
    console.error("Fallo de conexión LAN:", error);
  });

  socket.on("accion-maestro", (data) => {
    alRecibirAccion(data);
  });

  socket.on("estado-inicial-lan", (data) => {
    alRecibirEstadoInicial?.(data);
  });
};

export const emitirAccionMaestro = (data: any): boolean => {
  if (socket && socket.connected) {
    socket.emit("accion-esclavo", data);
    return true;
  } else {
    useEstadoRed.getState().setConectadoLAN(false);
    console.warn("Sin conexión con la PC Maestra");
    return false;
  }
};

// NUEVA FUNCIÓN
export const emitirSolicitudSyncEsclavo = (data: any) => {
  if (socket && socket.connected) {
    socket.emit("accion-esclavo", data);
  }
};